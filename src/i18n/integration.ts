/**
 * Astro integration for i18n.
 *
 * Orchestrates the i18n pipeline:
 *   1. Normalize catalogs (strip XML, migrate placeholders)
 *   2. Extract new strings from .astro → source catalog
 *   3. Prune dead strings (removed from all .astro files)
 *   4. Sync new keys to target locale catalogs
 *   5. Clean up stale locale artifacts (removed locales, orphaned markdown)
 *   6. Translate markdown content (manifest-protected)
 *   7. Translate catalog strings (manifest-protected)
 *   8. Post-process HTML output (replace source-locale text with translations)
 *
 * All I/O is async (fs/promises) — consistent with the rest of the pipeline.
 */

import type { AstroIntegration } from 'astro';
import { readFile } from 'node:fs/promises';
import { readConfig } from './config';
import { loadAllCatalogs, loadCatalog, saveCatalog, type CatalogSet } from './catalog';
import { extractFromAstro } from './extract';
import { normalizeCatalogs } from './normalize';
import { getProvider } from './provider';
import { postProcessBuild } from './postprocess';
import { translateContent, cleanMarkdownOrphans, cleanRemovedLocaleDirs } from '../utils/i18n-md';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, catalogNeedsTranslation, markCatalogTranslated } from '../utils/i18n-manifest';

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

        // ── Catalog maintenance ──────────────────────────────────────

        await normalizeCatalogs(locales);

        // ── Extract strings from .astro files ────────────────────────

        const astroFiles = await glob('src/**/*.astro', { ignore: ['src/locales/**', 'node_modules/**'] });
        const activeStrings = new Set<string>();

        for (const file of astroFiles) {
          try {
            const content = await readFile(file, 'utf-8');
            const extracted = await extractFromAstro(content, file);
            for (const item of extracted) {
              const msgid = item.msgid.replace(/\s+/g, ' ').trim();
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
        for (const text of activeStrings) {
          if (!(text in srcCatalog)) {
            srcCatalog[text] = ''; // placeholder: untranslated
            newStrings++;
          }
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
        await postProcessBuild(dir, catalogs, defaultLocale);
      },
    },
  };
}
