/**
 * Catalog key/value normalization.
 *
 * Strips Wuchale XML tags, decodes HTML entities, and migrates
 * untranslated placeholders (key===value → '') in non-English locales.
 */

import { loadCatalog, saveCatalog } from './catalog';

/** Strip Wuchale XML tags and normalize text for catalog matching. */
function normalizeText(text: string): string {
  return text
    .replace(/<\d+>/g, '')
    .replace(/<\/\d+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize all locale catalogs in place:
 * - Strip Wuchale XML tags from keys and values
 * - Decode HTML entities
 * - Migrate key===value placeholders → empty string (non-EN)
 *
 * Returns true if any catalog was modified.
 */
export function normalizeCatalogs(locales: string[]): boolean {
  let changed = false;

  for (const locale of locales) {
    const raw = loadCatalog('src/locales', locale);
    const normalized: Record<string, string> = {};
    let localeChanged = false;

    for (const [key, val] of Object.entries(raw)) {
      const cleanKey = normalizeText(key);
      let cleanVal = normalizeText(val);

      // Migration: key===value in non-English locale = untranslated placeholder
      if (locale !== 'en' && cleanVal === cleanKey) {
        cleanVal = '';
      }

      if (cleanKey !== key || cleanVal !== val) localeChanged = true;
      if (cleanKey) normalized[cleanKey] = cleanVal;
    }

    if (localeChanged) {
      saveCatalog('src/locales', locale, normalized);
      changed = true;
    }
  }

  if (changed) {
    console.log('[i18n] Normalized catalogs: stripped XML tags, decoded entities, migrated placeholders');
  }

  return changed;
}
