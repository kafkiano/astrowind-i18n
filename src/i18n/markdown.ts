/**
 * Translate markdown content from source locale to all target locales.
 *
 * Reads:  src/data/{type}/{sourceLocale}/*.{md,mdx}
 * Writes: src/data/{type}/{targetLocale}/*.{md,mdx}
 *
 * Translates both body content and all translatable frontmatter fields.
 * Frontmatter is parsed as YAML (js-yaml), all nested string values are
 * collected, translated, and reconstructed — supporting rich frontmatter
 * with nested objects and arrays (e.g. landing page section definitions).
 *
 * Uses a content-addressable manifest (.i18n-manifest.json) so
 * re-builds skip unchanged source files (git-safe — not mtime-based).
 *
 * Called by the i18n Astro integration during build.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { type TranslationProvider } from './provider';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, needsTranslation, markTranslated } from './manifest';

const CONTENT_TYPES = [
  { dir: 'src/data/pages', pattern: '**/*.md' },
  { dir: 'src/data/post', pattern: '**/*.{md,mdx}' },
  { dir: 'src/data/templates', pattern: '**/*.md' },
  { dir: 'src/data/snippets', pattern: '**/*.md' },
];

// ── YAML frontmatter helpers ──────────────────────────────────────

/** Keys whose values are identifiers/enums and should never be translated. */
const NON_TRANSLATABLE_KEYS = new Set([
  'showIn',
  'target',
  'variant',
  'icon',
  'name',
  'job',
  'type',
  'href',
  'src',
  'slug',
  'pathname',
  'page',
  'base',
  'rel',
  'lang',
  'dir',
  'id',
  'key',
  'url',
  'link',
  'to',
  'from',
  'ref',
  'class',
  'classes',
  'style',
]);

/** Recursively collect all translatable string leaf values from a parsed YAML object. */
function collectTranslatableStrings(obj: unknown, prefix = ''): Array<{ path: string; value: string }> {
  const result: Array<{ path: string; value: string }> = [];

  if (typeof obj === 'string') {
    // Extract the leaf key name from the path (last segment after . or [)
    // eslint-disable-next-line no-useless-escape
    const leafKey = prefix.replace(/^.*[.\[]/, '').replace(/\]$/, '');
    if (!NON_TRANSLATABLE_KEYS.has(leafKey) && isTranslatable(obj)) {
      result.push({ path: prefix, value: obj });
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const childResults = collectTranslatableStrings(obj[i], `${prefix}[${i}]`);
      result.push(...childResults);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const childResults = collectTranslatableStrings(val, prefix ? `${prefix}.${key}` : key);
      result.push(...childResults);
    }
  }

  return result;
}

const ASSET_EXTENSION_RE = /\.(jpe?g|png|webp|svg|pdf|mdx?)$/i;

/** Check if a string value should be translated (exclude URLs, icons, emails, phones, numbers). */
function isTranslatable(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  // Relative paths and URL-like identifiers
  if (/^[~./]/.test(trimmed)) return false;
  // URLs with common schemes, anchors, and protocol URLs
  if (/^(https?:\/\/|mailto:|tel:|sms:|#)/i.test(trimmed)) return false;
  // Common asset extensions
  if (ASSET_EXTENSION_RE.test(trimmed)) return false;
  // CSS class-like strings (single Tailwind class or modifier variant)
  if (/^(text-|bg-|font-|hover:|dark:|sm:|md:|lg:|xl:)[a-z0-9-:/]+$/i.test(trimmed)) return false;
  // Icon references (e.g. tabler:brand-facebook)
  if (/^[a-z][a-z0-9]*(:[a-z][a-z0-9-]*)+$/i.test(trimmed)) return false;
  // Email addresses
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return false;
  // Phone/fax numbers (mostly digits, +, spaces, dashes, parens)
  if (/^[+\d\s\-()]{6,}$/.test(trimmed)) return false;
  // Pure numbers
  if (/^\d+$/.test(trimmed)) return false;
  // HTML fragments (contain tags)
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return false;
  return true;
}

/** Indexable type for traversing nested YAML/object structures. */
type NestedIndexable = { [key: string]: unknown } | unknown[];

/** Set a value at a dotted/array path in a nested object. */
function setValueAtPath(obj: Record<string, unknown>, path: string, value: string): void {
  // eslint-disable-next-line no-useless-escape
  const parts = path.split(/(?<=[^\[\]])\.|(?<=\])\.|\[|\]/).filter(Boolean);
  let current: NestedIndexable = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (/^\d+$/.test(key)) {
      const arr = current as unknown[];
      current = arr[parseInt(key)] as NestedIndexable;
    } else {
      const obj = current as { [key: string]: unknown };
      if (obj[key] === undefined) return; // safety: path doesn't exist
      current = obj[key] as NestedIndexable;
    }
  }

  const lastKey = parts[parts.length - 1];
  if (/^\d+$/.test(lastKey)) {
    (current as unknown[])[parseInt(lastKey)] = value;
  } else {
    (current as { [key: string]: unknown })[lastKey] = value;
  }
}

/**
 * Restore original quoting style after yaml.dump() strips it.
 *
 * yaml.load() discards quote information, and yaml.dump() only adds
 * quotes when syntactically necessary. This function compares the
 * dumped output line-by-line against the source frontmatter and
 * re-applies quotes where the source had them.
 *
 * Matches lines of the form:  key: value  or  key: 'value'  or  key: "value"
 * Skips multi-line block scalars (|, >) and nested structure lines.
 */
function restoreQuoting(source: string, dumped: string): string {
  const YAML_LINE_RE = /^(\s*[\w.-]+):\s*(['"]?)((?:(?!\s+#).)*?)(\2)\s*(#.*)?$/;

  const sourceLines = source.split('\n');
  const dumpedLines = dumped.split('\n');

  // Build a lookup: key → source quote character (empty string if unquoted)
  const sourceQuoteByKey = new Map<string, string>();
  for (const line of sourceLines) {
    const m = line.match(YAML_LINE_RE);
    if (m) {
      sourceQuoteByKey.set(m[1].trim(), m[2]); // m[2] is ' or " or ''
    }
  }

  return dumpedLines
    .map((line) => {
      const m = line.match(YAML_LINE_RE);
      if (!m) return line;

      const key = m[1].trim();
      const dumpedQuote = m[2];
      const value = m[3];
      const trailing = m[5] || '';

      // Only restore quotes if the source had them and the dump dropped them
      const sourceQuote = sourceQuoteByKey.get(key);
      if (sourceQuote && !dumpedQuote && value) {
        const pad = line.match(/^(\s*)/)?.[1] || '';
        const comment = trailing ? ` ${trailing}` : '';
        // If the translated value contains the source quote character,
        // switch to the other quote style to avoid invalid YAML.
        let quote = sourceQuote;
        if (value.includes(quote)) {
          quote = quote === "'" ? '"' : "'";
          if (value.includes(quote)) return line; // contains both — skip
        }
        return `${pad}${key}: ${quote}${value}${quote}${comment}`;
      }

      return line;
    })
    .join('\n');
}

/** Parse frontmatter YAML, translate all nested strings, dump back. Returns null if parsing fails. */
export async function translateFrontmatterYaml(
  frontmatter: string,
  provider: TranslationProvider,
  locale: string,
  defaultLocale: string
): Promise<string | null> {
  let fmObj: unknown;
  try {
    fmObj = yaml.load(frontmatter);
  } catch {
    return null; // malformed YAML — caller should fall back
  }

  if (!fmObj || typeof fmObj !== 'object') return null;

  const translatable = collectTranslatableStrings(fmObj);
  if (translatable.length === 0) return frontmatter; // nothing to translate

  const texts = translatable.map((t) => t.value);
  const results = await provider.translatePlainTextBatch(texts, locale, defaultLocale);

  let anyTranslated = false;
  for (let i = 0; i < translatable.length; i++) {
    if (results[i] && results[i] !== translatable[i].value) {
      setValueAtPath(fmObj as Record<string, unknown>, translatable[i].path, results[i]);
      anyTranslated = true;
    }
  }

  if (!anyTranslated) return frontmatter;

  const dumped = yaml
    .dump(fmObj, {
      indent: 2,
      lineWidth: -1,
      noCompatMode: true,
      sortKeys: false,
    })
    .trim();

  return restoreQuoting(frontmatter, dumped);
}

// ── Main translation logic ────────────────────────────────────────

/**
 * Translate all markdown content. Called by the i18n integration during build.
 *
 * Incremental — skips files whose source hash matches the manifest
 * (no change since last translation). Content-addressable: survives
 * git clone, branch switches, and mtime resets.
 *
 * @param provider - Translation provider (DeepL, Google Translate, etc.)
 * @param locales - All configured locales (from config.yaml).
 * @param defaultLocale - Source locale (from config.yaml i18n.defaultLocale).
 */
export async function translateContent(
  provider: TranslationProvider,
  locales: string[],
  defaultLocale: string
): Promise<void> {
  const targetLocales = locales.filter((l) => l !== defaultLocale);
  if (targetLocales.length === 0) return;
  let manifest = await loadManifest();
  let manifestChanged = false;
  let anyWork = false;

  for (const { dir, pattern } of CONTENT_TYPES) {
    const srcDir = join(dir, defaultLocale);
    const files = await glob(pattern, { cwd: srcDir });
    if (files.length === 0) continue;

    let translated = 0;
    let skipped = 0;

    for (const relPath of files) {
      const srcPath = join(srcDir, relPath);
      const srcContent = await readFile(srcPath, 'utf-8');
      const { frontmatter, body } = splitFrontmatter(srcContent);
      if (!body.trim() && !frontmatter.trim()) continue;

      // Check manifest — skip if source content hasn't changed
      const manifestKey = `${dir}/${defaultLocale}/${relPath}`;
      const sourceUnchanged = !(await needsTranslation(manifest, manifestKey, srcContent));

      // Even if source is unchanged, check that all target locales have the file.
      // A newly added locale won't have translations yet.
      let allTargetsExist = true;
      if (sourceUnchanged) {
        for (const locale of targetLocales) {
          const outPath = join(dir, locale, relPath);
          try {
            await readFile(outPath, 'utf-8');
          } catch {
            allTargetsExist = false;
            break;
          }
        }
      }

      if (sourceUnchanged && allTargetsExist) {
        skipped++;
        continue;
      }

      let allLocalesSucceeded = true;

      for (const locale of targetLocales) {
        const outPath = join(dir, locale, relPath);

        let translatedFm = frontmatter;
        let translatedBody = body;
        let bodyTranslated = !body.trim(); // true if no body to translate
        let fmTranslated = !frontmatter.trim(); // true if no frontmatter to translate

        // ── Translate frontmatter (nested YAML) ─────────────────

        if (frontmatter.trim()) {
          try {
            const result = await translateFrontmatterYaml(frontmatter, provider, locale, defaultLocale);
            if (result !== null) {
              translatedFm = result;
              fmTranslated = true;
            }
          } catch (err) {
            console.warn(`  ⚠ fm translation failed for ${locale}:`, (err as Error).message);
          }
        }

        // ── Translate body (full multi-line text) ───────────────

        if (body.trim()) {
          try {
            const result = await provider.translatePlainText(body, locale, defaultLocale);
            if (result) {
              translatedBody = result;
              bodyTranslated = true;
            }
          } catch (err) {
            console.warn(`  ⚠ body translation failed for ${locale}:`, (err as Error).message);
          }
        }

        // Only write if translation actually produced results
        const shouldWrite = body.trim() ? bodyTranslated : fmTranslated;
        if (shouldWrite) {
          const output = `---\n${translatedFm}\n---\n\n${translatedBody}\n`;
          await mkdir(join(outPath, '..'), { recursive: true });
          await writeFile(outPath, output, 'utf-8');

          if (!anyWork) {
            anyWork = true;
            console.log(`[content] Translating via ${provider.name}...`);
          }
          translated++;
          console.log(`  ✓ ${outPath}`);
        } else {
          allLocalesSucceeded = false;
          console.warn(`  ⚠ Skipping ${outPath}: translation failed (will retry on next build)`);
        }
      }

      // Only mark source as translated in manifest if ALL locales succeeded
      if (allLocalesSucceeded) {
        manifest = await markTranslated(manifest, manifestKey, srcContent);
        manifestChanged = true;
      }
    }

    if (translated > 0 || skipped > 0) {
      console.log(
        `─ ${dir}/${defaultLocale}/ → ${files.length} files (${translated} translated, ${skipped} unchanged)`
      );
    }
  }

  if (manifestChanged) {
    await saveManifest(manifest);
  }

  if (anyWork) {
    console.log('Done.');
  }
}

// ── Legacy helpers (splitFrontmatter still needed) ────────────────

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return { frontmatter: '', body: content };
  const secondSep = trimmed.indexOf('\n---', 3);
  if (secondSep === -1) {
    const alt = trimmed.indexOf('---', 3);
    if (alt === -1) return { frontmatter: '', body: content };
    return { frontmatter: trimmed.slice(4, alt).trim(), body: trimmed.slice(alt + 3).trim() };
  }
  return { frontmatter: trimmed.slice(4, secondSep).trim(), body: trimmed.slice(secondSep + 4).trim() };
}
