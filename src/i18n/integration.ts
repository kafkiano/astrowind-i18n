/**
 * Astro integration for i18n: post-processes HTML output, replacing
 * English strings with translations from JSON catalogs.
 *
 * Runs after all pages are built. Walks dist/ output, translates
 * HTML content for non-English locales using simple string replacement.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadAllCatalogs, loadCatalog, mergeExtracted, saveCatalog, type CatalogSet } from './catalog';
import { extractFromAstro } from './extract';
import { getProvider, type TranslationProvider } from './provider';
import { translateContent } from '../utils/i18n-md';
import { glob } from 'tinyglobby';
import yaml from 'js-yaml';

function getLocales(): string[] {
  const configPath = path.resolve('src/config.yaml');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(raw) as { i18n?: { locales?: string[]; defaultLocale?: string } };
  return config?.i18n?.locales || ['en'];
}

// ---------------------------------------------------------------------------
// HTML post-processing
// ---------------------------------------------------------------------------

function translateHtml(html: string, locale: string, catalogs: CatalogSet): string {
  if (locale === 'en') return html;

  const targetCatalog = catalogs[locale];
  if (!targetCatalog) return html;

  // Only translate COMPLETE text segments — no substring tokenization.
  // Normalize HTML entities before lookup to handle &amp; vs & mismatches.
  return html.replace(/>([^<]*)</g, (match, textBetween: string) => {
    const trimmed = textBetween.trim();
    if (!trimmed) return match;

    // Try exact match first, then entity-decoded match
    let translation = targetCatalog[trimmed];
    if (!translation || translation === trimmed) {
      const decoded = decodeEntities(trimmed);
      if (decoded !== trimmed) {
        translation = targetCatalog[decoded];
      }
    }

    if (translation && translation !== trimmed) {
      const leading = textBetween.match(/^\s*/)?.[0] ?? '';
      const trailing = textBetween.match(/\s*$/)?.[0] ?? '';
      return `>${leading}${translation}${trailing}<`;
    }

    return match;
  });
}

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

/** Strip Wuchale XML tags and normalize text for catalog matching. */
function normalizeKey(key: string): string {
  return key
    .replace(/<\d+>/g, '')
    .replace(/<\/\d+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Recursive walk dist/
// ---------------------------------------------------------------------------

function walkDir(dir: string, visitor: (filePath: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, visitor);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      visitor(fullPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Astro integration
// ---------------------------------------------------------------------------

export function i18nIntegration(): AstroIntegration {
  let catalogs: CatalogSet;

  return {
    name: 'astrowind-i18n',
    hooks: {
      'astro:config:setup': async () => {
        const locales = getLocales();

        // Normalize all catalog keys: strip Wuchale XML tags, decode entities.
        let catalogChanged = false;
        for (const locale of locales) {
          const raw = loadCatalog('src/locales', locale);
          const normalized: Record<string, string> = {};
          let localeChanged = false;
          for (const [key, val] of Object.entries(raw)) {
            const cleanKey = normalizeKey(key);
            const cleanVal = normalizeKey(val);
            if (cleanKey !== key || cleanVal !== val) localeChanged = true;
            if (cleanKey) normalized[cleanKey] = cleanVal || cleanKey;
          }
          if (localeChanged) {
            saveCatalog('src/locales', locale, normalized);
            catalogChanged = true;
          }
        }
        if (catalogChanged) {
          console.log('[i18n] Normalized catalogs: stripped XML tags, decoded entities');
        }

        let enCatalog = loadCatalog('src/locales', 'en');

        // Extract new strings from .astro files
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

          // Sync new keys to target locale catalogs (with placeholder values)
          for (const locale of locales) {
            if (locale === 'en') continue;
            const targetCatalog = loadCatalog('src/locales', locale);
            let synced = 0;
            for (const [key] of Object.entries(enCatalog)) {
              if (!(key in targetCatalog)) {
                targetCatalog[key] = key; // placeholder: English
                synced++;
              }
            }
            if (synced > 0) {
              saveCatalog('src/locales', locale, targetCatalog);
            }
          }
        }

        // Auto-translate untranslated strings via configured provider
        const provider = await getProvider();

        if (provider) {
          // 1. Translate markdown content (incremental — only changed files)
          await translateContent(provider);

          // 2. Translate UI catalog strings
          let totalTranslated = 0;
          for (const locale of locales) {
            if (locale === 'en') continue;
            try {
              const catalog = loadCatalog('src/locales', locale);
              const untranslated = Object.keys(catalog).filter((k) => catalog[k] === k);
              if (untranslated.length === 0) continue;

              const translations = await provider.translateBatch(untranslated, locale, 'en');
              let localeTranslated = 0;
              for (let i = 0; i < untranslated.length; i++) {
                if (translations[i] && translations[i] !== untranslated[i]) {
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
        }

        catalogs = loadAllCatalogs('src/locales', locales);
        console.log(`[i18n] Loaded catalogs for: ${Object.keys(catalogs).join(', ')}`);
      },

      'astro:build:done': ({ dir }) => {
        const distDir = fileURLToPath(dir);
        console.log(`[i18n] Post-processing HTML in ${distDir}...`);

        let processed = 0;
        let translated = 0;

        walkDir(distDir, (filePath: string) => {
          // Determine locale from path: /dist/de/pricing/index.html → de
          const relPath = path.relative(distDir, filePath);
          const localeMatch = relPath.match(/^([a-z]{2})\//);
          if (!localeMatch) return;

          const locale = localeMatch[1];
          if (locale === 'en') return;

          processed++;
          try {
            const html = fs.readFileSync(filePath, 'utf-8');
            const translatedHtml = translateHtml(html, locale, catalogs);
            if (translatedHtml !== html) {
              fs.writeFileSync(filePath, translatedHtml, 'utf-8');
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
