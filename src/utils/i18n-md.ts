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
 * Skips files whose output already exists and is up-to-date (mtime check).
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { getProvider, type TranslationProvider } from '../i18n/provider';
import { glob } from 'tinyglobby';

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
 * Incremental — only re-translates files whose source has changed.
 */
export async function translateContent(provider: TranslationProvider): Promise<void> {
  console.log(`[content] Translating via ${provider.name}...`);

  for (const { dir, pattern } of CONTENT_TYPES) {
    const srcDir = join(dir, SOURCE_LOCALE);
    const files = await glob(pattern, { cwd: srcDir });
    if (files.length === 0) continue;

    console.log(`─ ${dir}/${SOURCE_LOCALE}/ → ${files.length} files`);

    for (const relPath of files) {
      const srcPath = join(srcDir, relPath);
      const srcContent = await readFile(srcPath, 'utf-8');
      const { frontmatter, body } = splitFrontmatter(srcContent);
      if (!body.trim() && !hasTranslatableFm(frontmatter)) continue;

      for (const locale of TARGET_LOCALES) {
        const outPath = join(dir, locale, relPath);
        if (await isUpToDate(outPath, srcPath)) continue;

        let translatedFm = frontmatter;
        let translatedBody = body;

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
              }
            }
          } catch (err) {
            console.warn(`  ⚠ fm translation failed for ${locale}:`, (err as Error).message);
          }
        }

        // Translate body
        if (body.trim()) {
          try {
            const [result] = await provider.translateBatch([body], locale, SOURCE_LOCALE);
            if (result && result !== body) translatedBody = result;
          } catch (err) {
            console.warn(`  ⚠ body translation failed for ${locale}:`, (err as Error).message);
          }
        }

        const output = `---\n${translatedFm}\n---\n\n${translatedBody}\n`;
        await mkdir(join(outPath, '..'), { recursive: true });
        await writeFile(outPath, output, 'utf-8');
        console.log(`  ✓ ${outPath}`);
      }
    }
    console.log();
  }

  console.log('Done.');
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

async function isUpToDate(outPath: string, srcPath: string): Promise<boolean> {
  try {
    const [outStat, srcStat] = await Promise.all([stat(outPath), stat(srcPath)]);
    return outStat.mtimeMs >= srcStat.mtimeMs;
  } catch {
    return false;
  }
}

// Only run main() when executed directly (not when imported)
if (process.argv[1]?.includes('translate-content')) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
