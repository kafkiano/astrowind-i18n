/**
 * Astro integration for i18n.
 *
 * Orchestrates the i18n pipeline:
 *   1. Normalize catalogs (strip XML, migrate placeholders)
 *   2. Extract new strings from .astro → en.json
 *   3. Sync new keys to target locale catalogs
 *   4. Translate markdown content (manifest-protected)
 *   5. Translate catalog strings (manifest-protected)
 *   6. Post-process HTML output (replace English with translations)
 */

import fs from 'node:fs';
import type { AstroIntegration } from 'astro';
import { readConfig } from './config';
import { loadAllCatalogs, loadCatalog, mergeExtracted, saveCatalog, type CatalogSet } from './catalog';
import { extractFromAstro } from './extract';
import { normalizeCatalogs } from './normalize';
import { getProvider } from './provider';
import { postProcessBuild } from './postprocess';
import { translateContent } from '../utils/i18n-md';
import { glob } from 'tinyglobby';
import { loadManifest, saveManifest, catalogNeedsTranslation, markCatalogTranslated } from '../utils/i18n-manifest';

export function i18nIntegration(): AstroIntegration {
  let catalogs: CatalogSet;

  return {
    name: 'astrowind-i18n',
    hooks: {
      'astro:config:setup': async () => {
        const config = readConfig();
        const { locales } = config;

        // ── Catalog maintenance ──────────────────────────────────────

        normalizeCatalogs(locales);

        // ── Extract + sync strings ───────────────────────────────────

        let enCatalog = loadCatalog('src/locales', 'en');
        const astroFiles = await glob('src/**/*.astro', { ignore: ['src/locales/**', 'node_modules/**'] });
        let newStrings = 0;

        for (const file of astroFiles) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            const extracted = await extractFromAstro(content, file);
            const result = mergeExtracted(enCatalog, extracted);
            enCatalog = result.catalog;
            newStrings += result.newCount;
          } catch {
            // Skip files that can't be parsed
          }
        }

        if (newStrings > 0) {
          saveCatalog('src/locales', 'en', enCatalog);
          console.log(`[i18n] ${newStrings} new strings extracted to en.json`);

          // Sync new keys to target locale catalogs (empty placeholder = untranslated)
          for (const locale of locales) {
            if (locale === 'en') continue;
            const targetCatalog = loadCatalog('src/locales', locale);
            let synced = 0;
            for (const [key] of Object.entries(enCatalog)) {
              if (!(key in targetCatalog)) {
                targetCatalog[key] = ''; // empty = needs translation
                synced++;
              }
            }
            if (synced > 0) {
              saveCatalog('src/locales', locale, targetCatalog);
            }
          }
        }

        // ── Translation (manifest-protected) ─────────────────────────

        const provider = await getProvider();
        if (provider) {
          // 1. Translate markdown content
          await translateContent(provider);

          // 2. Translate UI catalog strings
          const enJson = JSON.stringify(loadCatalog('src/locales', 'en'), null, 2);
          let manifest = await loadManifest();

          if (catalogNeedsTranslation(manifest, enJson)) {
            let totalTranslated = 0;
            for (const locale of locales) {
              if (locale === 'en') continue;
              try {
                const catalog = loadCatalog('src/locales', locale);
                const untranslated = Object.keys(catalog).filter((k) => catalog[k] === '');
                if (untranslated.length === 0) continue;

                const translations = await provider.translateBatch(untranslated, locale, 'en');
                let localeTranslated = 0;
                for (let i = 0; i < untranslated.length; i++) {
                  if (translations[i]) {
                    catalog[untranslated[i]] = translations[i];
                    localeTranslated++;
                  }
                }
                if (localeTranslated > 0) {
                  saveCatalog('src/locales', locale, catalog);
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
              if (locale === 'en') continue;
              const cat = loadCatalog('src/locales', locale);
              if (Object.keys(cat).some((k) => cat[k] === '')) {
                stillUntranslated = true;
                break;
              }
            }
            if (!stillUntranslated) {
              manifest = markCatalogTranslated(manifest, enJson);
              await saveManifest(manifest);
            } else if (totalTranslated > 0) {
              console.log('[i18n] Some strings still untranslated — will retry on next build');
            }
          }
        }

        // ── Load catalogs for post-processing ────────────────────────

        catalogs = loadAllCatalogs('src/locales', locales);
        console.log(`[i18n] Loaded catalogs for: ${Object.keys(catalogs).join(', ')}`);
      },

      'astro:build:done': ({ dir }) => {
        postProcessBuild(dir, catalogs);
      },
    },
  };
}
