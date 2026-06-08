/**
 * Astro integration for i18n.
 *
 * Orchestrates the i18n pipeline:
 *   1. Extract new strings from .astro → source catalog
 *   2. Prune dead strings (removed from all .astro files)
 *   3. Sync new keys to target locale catalogs
 *   4. Clean up stale locale artifacts (removed locales, orphaned markdown)
 *   5. Translate markdown content (manifest-protected)
 *   6. Translate catalog strings (manifest-protected)
 *   7. Post-process HTML output (replace source-locale text with translations)
 *
 * All I/O is async (fs/promises) — consistent with the rest of the pipeline.
 */

import type { AstroIntegration } from 'astro';
import { readFile, writeFile, readdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config';
import { loadAllCatalogs, loadCatalog, saveCatalog, type CatalogSet } from './catalog';
import { extractFromAstro } from './extract';
import { getProvider } from './provider';
import { translateHtml } from './postprocess';
import { translateContent } from '../utils/i18n-md';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, catalogNeedsTranslation, markCatalogTranslated } from '../utils/i18n-manifest';

const CONTENT_TYPES = [
  { dir: 'src/data/pages', pattern: '**/*.md' },
  { dir: 'src/data/post', pattern: '**/*.{md,mdx}' },
];

/** Decode common HTML entities to their character equivalents. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function i18nIntegration(): AstroIntegration {
  let catalogs: CatalogSet;
  let defaultLocale: string;

  return {
    name: 'astrowind-i18n',
    hooks: {
      'astro:config:setup': async () => {
        const config = readConfig();
        const { locales } = config;
        const srcLocale = config.defaultLocale;
        defaultLocale = srcLocale;

        // ── Extract strings from .astro files ────────────────────────

        const astroFiles = await glob('src/**/*.astro', { ignore: ['src/locales/**', 'node_modules/**'] });
        const activeStrings = new Set<string>();

        for (const file of astroFiles) {
          try {
            const content = await readFile(file, 'utf-8');
            const extracted = await extractFromAstro(content, file);
            for (const item of extracted) {
              const msgid = decodeEntities(item.msgid.replace(/\s+/g, ' ').trim());
              if (msgid) activeStrings.add(msgid);
            }
          } catch (err) {
            console.warn(`[i18n] Skipped ${file}: ${(err as Error).message}`);
          }
        }

        // ── Prune dead strings + merge new into source catalog ──────

        const srcCatalog = await loadCatalog('src/locales', srcLocale);
        let newStrings = 0;
        let removedStrings = 0;

        // Find dead strings (in catalog but no longer in any .astro file)
        const deadStrings: string[] = [];
        for (const key of Object.keys(srcCatalog)) {
          if (!activeStrings.has(key)) {
            deadStrings.push(key);
          }
        }
        if (deadStrings.length > 0) {
          for (const key of deadStrings) {
            delete srcCatalog[key];
          }
          removedStrings = deadStrings.length;
        }

        // Merge in new strings
        for (const t of activeStrings) {
          const text = decodeEntities(t);
          if (!text || text in srcCatalog) continue;
          srcCatalog[text] = ''; // placeholder: untranslated
          newStrings++;
        }

        if (newStrings > 0 || removedStrings > 0) {
          await saveCatalog('src/locales', srcLocale, srcCatalog);
          const parts: string[] = [];
          if (newStrings > 0) parts.push(`${newStrings} new`);
          if (removedStrings > 0) parts.push(`${removedStrings} removed`);
          console.log(`[i18n] ${parts.join(', ')} strings in ${srcLocale}.json`);
        }

        // ── Sync changes to target locale catalogs ───────────────────

        for (const locale of locales) {
          if (locale === srcLocale) continue;
          const targetCatalog = await loadCatalog('src/locales', locale);
          let synced = 0;

          // Add new keys (from source catalog) with empty placeholder
          for (const [key] of Object.entries(srcCatalog)) {
            if (!(key in targetCatalog)) {
              targetCatalog[key] = '';
              synced++;
            }
          }

          // Remove dead keys no longer in source catalog
          for (const key of Object.keys(targetCatalog)) {
            if (!(key in srcCatalog)) {
              delete targetCatalog[key];
              synced++;
            }
          }

          if (synced > 0) {
            await saveCatalog('src/locales', locale, targetCatalog);
          }
        }

        // ── Clean up removed locales ─────────────────────────────────

        await cleanRemovedLocaleDirs(locales, srcLocale);

        // ── Translation (manifest-protected) ─────────────────────────

        const provider = await getProvider();
        if (provider) {
          // 1. Translate markdown content
          await translateContent(provider, locales, srcLocale);

          // 2. Clean up orphaned markdown (source deleted, translation remains)
          await cleanMarkdownOrphans(locales, srcLocale);

          // 3. Translate UI catalog strings
          const srcJson = JSON.stringify(await loadCatalog('src/locales', srcLocale), null, 2);
          let manifest = await loadManifest();

          // Check if source catalog changed OR any target locale has untranslated gaps
          let hasGaps = false;
          for (const locale of locales) {
            if (locale === srcLocale) continue;
            const cat = await loadCatalog('src/locales', locale);
            if (Object.keys(cat).some((k) => cat[k] === '')) {
              hasGaps = true;
              break;
            }
          }

          if (hasGaps || catalogNeedsTranslation(manifest, srcJson, srcLocale)) {
            let totalTranslated = 0;
            for (const locale of locales) {
              if (locale === srcLocale) continue;
              try {
                const catalog = await loadCatalog('src/locales', locale);
                const untranslated = Object.keys(catalog).filter((k) => catalog[k] === '');
                if (untranslated.length === 0) continue;

                const translations = await provider.translateBatch(untranslated, locale, srcLocale);
                let localeTranslated = 0;
                for (let i = 0; i < untranslated.length; i++) {
                  if (translations[i]) {
                    catalog[untranslated[i]] = translations[i];
                    localeTranslated++;
                  }
                }
                if (localeTranslated > 0) {
                  await saveCatalog('src/locales', locale, catalog);
                  totalTranslated += localeTranslated;
                  console.log(`[i18n] ${provider.name} translated ${localeTranslated} strings to ${locale}`);
                }
              } catch {
                // Translation failure shouldn't block the build
              }
            }
            if (totalTranslated > 0) {
              console.log(`[i18n] ${provider.name}: ${totalTranslated} total translations across all locales`);
            }

            // Only update manifest if every locale is fully translated
            let stillUntranslated = false;
            for (const locale of locales) {
              if (locale === srcLocale) continue;
              const cat = await loadCatalog('src/locales', locale);
              if (Object.keys(cat).some((k) => cat[k] === '')) {
                stillUntranslated = true;
                break;
              }
            }
            if (!stillUntranslated) {
              manifest = markCatalogTranslated(manifest, srcJson, srcLocale);
              await saveManifest(manifest);
            } else if (totalTranslated > 0) {
              console.log('[i18n] Some strings still untranslated — will retry on next build');
            }
          }
        }

        // ── Load catalogs for post-processing ────────────────────────

        catalogs = await loadAllCatalogs('src/locales', locales);
        console.log(`[i18n] Loaded catalogs for: ${Object.keys(catalogs).join(', ')}`);
      },

      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        console.log(`[i18n] Post-processing HTML in ${distDir}...`);

        let processed = 0;
        let translated = 0;

        await walkHtmlFiles(distDir, async (filePath: string) => {
          const relPath = path.relative(distDir, filePath);
          const localeMatch = relPath.match(/^([a-z]{2})\//);
          if (!localeMatch) return;

          const locale = localeMatch[1];
          if (locale === defaultLocale) return;

          processed++;
          try {
            const html = await readFile(filePath, 'utf-8');
            const translatedHtml = translateHtml(html, locale, catalogs, defaultLocale);
            if (translatedHtml !== html) {
              await writeFile(filePath, translatedHtml, 'utf-8');
              translated++;
            }
          } catch (err) {
            console.warn(`[i18n] Failed: ${relPath} — ${(err as Error).message}`);
          }
        });

        console.log(`[i18n] Done: ${translated}/${processed} pages translated`);
      },
    },
  };
}

/** Walk a directory recursively, visiting .html files (async). */
async function walkHtmlFiles(dir: string, visitor: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkHtmlFiles(fullPath, visitor);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      await visitor(fullPath);
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove translated markdown files whose source (in the default locale)
 * no longer exists. Prevents stale content from being published after
 * a source file is deleted.
 */
async function cleanMarkdownOrphans(locales: string[], sourceLocale: string): Promise<void> {
  const targetLocales = locales.filter((l) => l !== sourceLocale);
  if (targetLocales.length === 0) return;

  let manifest = await loadManifest();
  let manifestChanged = false;

  for (const { dir } of CONTENT_TYPES) {
    const srcDir = path.join(dir, sourceLocale);
    if (!(await fileExists(srcDir))) continue; // no source dir = nothing to compare against

    for (const locale of targetLocales) {
      const targetDir = path.join(dir, locale);
      if (!(await fileExists(targetDir))) continue;

      let files: string[];
      try {
        files = await glob('**/*.{md,mdx}', { cwd: targetDir });
      } catch {
        continue;
      }

      for (const relPath of files) {
        const srcPath = path.join(srcDir, relPath);
        if (await fileExists(srcPath)) continue; // source still exists, keep

        // Source deleted — clean up translation
        const targetPath = path.join(targetDir, relPath);
        const manifestKey = `${dir}/${sourceLocale}/${relPath}`;

        try {
          await rm(targetPath);
          console.log(`[clean] Removed orphan: ${targetPath}`);
        } catch (err) {
          console.warn(`[clean] Failed to remove ${targetPath}:`, (err as Error).message);
        }

        // Remove from manifest so it doesn't linger
        if (manifest.markdown[manifestKey]) {
          const rest = { ...manifest.markdown };
          delete rest[manifestKey];
          manifest = { ...manifest, markdown: rest };
          manifestChanged = true;
        }
      }
    }
  }

  if (manifestChanged) {
    await saveManifest(manifest);
  }
}

/**
 * Warn about stale locale directories (from locales that were removed
 * from config.yaml). Does NOT auto-delete — manual cleanup is safer.
 */
async function cleanRemovedLocaleDirs(locales: string[], sourceLocale: string): Promise<void> {
  const activeLocales = new Set(locales);
  activeLocales.add(sourceLocale); // source locale dirs are needed too

  // Check content directories for removed locales
  for (const { dir } of CONTENT_TYPES) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^[a-z]{2}$/.test(entry.name)) continue;
      if (activeLocales.has(entry.name)) continue;
      console.warn(`[i18n] Stale locale dir (not in config.yaml locales): ${path.join(dir, entry.name)}/`);
    }
  }

  // Check catalog files for removed locales
  try {
    const catalogEntries = await readdir('src/locales', { withFileTypes: true });
    for (const entry of catalogEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const locale = entry.name.replace(/\.json$/, '');
      if (!/^[a-z]{2}$/.test(locale)) continue;
      if (activeLocales.has(locale)) continue;
      console.warn(`[i18n] Stale catalog file (not in config.yaml locales): src/locales/${entry.name}`);
    }
  } catch {
    // src/locales might not exist yet — ignore
  }
}
