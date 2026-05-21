#!/usr/bin/env bun
/**
 * Translate markdown content from source locale to all target locales.
 *
 * Usage:
 *   I18N_PROVIDER=deepl DEEPL_API_KEY=... bun run src/utils/i18n-md.ts
 *   GEMINI_API_KEY=... bun run src/utils/i18n-md.ts
 *
 * Reads:  src/data/{type}/{sourceLocale}/*.{md,mdx}
 * Writes: src/data/{type}/{targetLocale}/*.{md,mdx}
 *
 * Translates both body content and specified frontmatter fields.
 * Uses a content-addressable manifest (.i18n-manifest.json) so that
 * re-builds skip unchanged source files (git-safe — not mtime-based).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getProvider, type TranslationProvider } from '../i18n/provider';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, needsTranslation, markTranslated } from './i18n-manifest';

const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['es', 'fr', 'de'];
const FRONTMATTER_KEYS = ['title', 'excerpt', 'description', 'group'];
const CONTENT_TYPES = [
  { dir: 'src/data/pages', pattern: '**/*.md' },
  { dir: 'src/data/post', pattern: '**/*.{md,mdx}' },
];

async function main() {
  const provider = await getProvider();
  if (!provider) {
    console.error('No translation provider configured.');
    process.exit(1);
  }
  await translateContent(provider);
  console.log('Done.');
}

/**
 * Translate all markdown content. Called by the i18n integration during build,
 * or directly via CLI (`bun run src/utils/translate-content.ts`).
 *
 * Incremental — skips files whose source hash matches the manifest
 * (no change since last translation). Content-addressable: survives
 * git clone, branch switches, and mtime resets.
 */
export async function translateContent(provider: TranslationProvider): Promise<void> {
  let manifest = await loadManifest();
  let manifestChanged = false;
  let anyWork = false;

  for (const { dir, pattern } of CONTENT_TYPES) {
    const srcDir = join(dir, SOURCE_LOCALE);
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
      const manifestKey = `${dir}/${SOURCE_LOCALE}/${relPath}`;
      if (!(await needsTranslation(manifest, manifestKey, srcContent))) {
        skipped++;
        continue;
      }

      let allLocalesSucceeded = true;

      for (const locale of TARGET_LOCALES) {
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
            const fmResults = await provider.translateBatch(fmTexts, locale, SOURCE_LOCALE);
            for (let i = 0; i < fmKeys.length; i++) {
              if (fmResults[i] && fmResults[i] !== fmTexts[i]) {
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

        // Translate body
        if (body.trim()) {
          try {
            const [result] = await provider.translateBatch([body], locale, SOURCE_LOCALE);
            if (result && result !== body) {
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
        `─ ${dir}/${SOURCE_LOCALE}/ → ${files.length} files (${translated} translated, ${skipped} unchanged)`
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

// Only run main() when executed directly (not when imported)
if (process.argv[1]?.includes('translate-content')) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
