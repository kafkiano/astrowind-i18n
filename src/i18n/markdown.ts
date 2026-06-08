/**
 * Translate markdown content from source locale to all target locales.
 *
 * Reads:  src/data/{type}/{sourceLocale}/*.{md,mdx}
 * Writes: src/data/{type}/{targetLocale}/*.{md,mdx}
 *
 * Translates both body content and specified frontmatter fields.
 * Uses a content-addressable manifest (.i18n-manifest.json) so
 * re-builds skip unchanged source files (git-safe — not mtime-based).
 *
 * Called by the i18n Astro integration during build.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type TranslationProvider } from './provider';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, needsTranslation, markTranslated } from './manifest';

const FRONTMATTER_KEYS = ['title', 'excerpt', 'description', 'group'];
const CONTENT_TYPES = [
  { dir: 'src/data/pages', pattern: '**/*.md' },
  { dir: 'src/data/post', pattern: '**/*.{md,mdx}' },
];

/**
 * Translate all markdown content. Called by the i18n integration during build.
 *
 * Incremental — skips files whose source hash matches the manifest
 * (no change since last translation). Content-addressable: survives
 * git clone, branch switches, and mtime resets.
 *
 * @param provider - Translation provider (Gemini, DeepL, etc.)
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
      if (!body.trim() && !hasTranslatableFm(frontmatter)) continue;

      // Check manifest — skip if source content hasn't changed
      const manifestKey = `${dir}/${defaultLocale}/${relPath}`;
      if (!(await needsTranslation(manifest, manifestKey, srcContent))) {
        skipped++;
        continue;
      }

      let allLocalesSucceeded = true;

      for (const locale of targetLocales) {
        const outPath = join(dir, locale, relPath);

        let translatedFm = frontmatter;
        let translatedBody = body;
        let bodyTranslated = !body.trim(); // true if no body to translate
        let allFmTranslated = true;

        // Translate frontmatter fields
        const fmTexts: string[] = [];
        const fmKeys: string[] = [];
        for (const key of FRONTMATTER_KEYS) {
          const val = extractFmValue(frontmatter, key);
          if (val && val.trim()) {
            fmTexts.push(val);
            fmKeys.push(key);
          }
        }

        if (fmTexts.length > 0) {
          try {
            const fmResults = await provider.translateBatch(fmTexts, locale, defaultLocale);
            for (let i = 0; i < fmKeys.length; i++) {
              if (fmResults[i]) {
                translatedFm = replaceFmValue(translatedFm, fmKeys[i], fmResults[i]);
              } else {
                allFmTranslated = false;
              }
            }
          } catch (err) {
            console.warn(`  ⚠ fm translation failed for ${locale}:`, (err as Error).message);
            allFmTranslated = false;
          }
        }

        // Translate body (full multi-line text, not line-by-line batch)
        if (body.trim()) {
          try {
            const result = await provider.translateText(body, locale, defaultLocale);
            if (result) {
              translatedBody = result;
              bodyTranslated = true;
            }
          } catch (err) {
            console.warn(`  ⚠ body translation failed for ${locale}:`, (err as Error).message);
          }
        }

        // Only write the output file if translation actually produced results.
        // If body or FM translation failed, skip this locale — otherwise we'd
        // write English content into the target locale directory.
        const shouldWrite = body.trim() ? bodyTranslated : allFmTranslated;
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

      // Only mark source as translated in manifest if ALL locales succeeded.
      // If any locale failed, retry on next build (e.g. API quota exhausted).
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

// --- Helpers ---

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

function extractFmValue(fm: string, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = fm.match(re);
  if (!match) return null;
  const val = match[1].trim();
  // Remove surrounding quotes
  return val.replace(/^['"](.*)['"]$/, '$1');
}

function replaceFmValue(fm: string, key: string, newVal: string): string {
  const re = new RegExp(`^(${key}:\\s*)(.+)$`, 'm');
  // Quote if value contains chars that break YAML (colons, hashes, etc.)
  const needsQuote = /[#&*{}[\]|>,!%@`'":\n]/.test(newVal);
  const replacement = needsQuote ? `'${newVal.replace(/'/g, "''")}'` : newVal;
  return fm.replace(re, `$1${replacement}`);
}

function hasTranslatableFm(fm: string): boolean {
  return FRONTMATTER_KEYS.some((k) => {
    const re = new RegExp(`^${k}:\\s*.+$`, 'm');
    return re.test(fm);
  });
}
