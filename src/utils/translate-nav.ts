/**
 * Build-time translation for navigation titles.
 *
 * Wuchale's exportRefs fix prevents the `_w_runtime_ is not defined` crash by
 * not mutating `export const navigation` declarations. Strings are still
 * extracted to .po catalogs. This utility looks up translations from compiled
 * catalogs so navigation titles rendered via auto-navigation.ts get translated.
 *
 * Uses Wuchale's compiled catalog arrays (one per locale), indexed by the EN
 * catalog to find the matching translated string in target locales.
 */

import type { CompiledElement } from 'wuchale';

/** Flatten a CompiledElement to a plain string (for simple text entries) */
function elementToString(el: CompiledElement): string | null {
  if (typeof el === 'string') return el;
  if (typeof el === 'number') return null;
  // Nested array — concatenate string parts only
  const parts: string[] = [];
  for (const part of el) {
    if (typeof part === 'string') parts.push(part);
  }
  return parts.join('') || null;
}

/**
 * Build a Map<englishString, index> from the English compiled catalog.
 * Only maps simple string entries (ignores rich/nested elements).
 */
function buildIndexMap(enCatalog: CompiledElement[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < enCatalog.length; i++) {
    const str = elementToString(enCatalog[i]);
    if (str !== null) {
      map.set(str, i);
    }
  }
  return map;
}

// Eagerly loaded catalogs — these run at build time (SSR in Astro)
const enCatalogPromise = import('../locales/.wuchale/main.0.en.compiled.js').then(m => m.c as CompiledElement[]);

const localeCatalogPromises: Record<string, Promise<CompiledElement[]>> = {
  es: import('../locales/.wuchale/main.0.es.compiled.js').then(m => m.c as CompiledElement[]),
  fr: import('../locales/.wuchale/main.0.fr.compiled.js').then(m => m.c as CompiledElement[]),
  de: import('../locales/.wuchale/main.0.de.compiled.js').then(m => m.c as CompiledElement[]),
};

/** Cache: englishString → Map<locale, translatedString> */
let translationCache: Map<string, Map<string, string>> | null = null;

async function getTranslationCache(): Promise<Map<string, Map<string, string>>> {
  if (translationCache) return translationCache;

  const enCatalog = await enCatalogPromise;
  const indexMap = buildIndexMap(enCatalog);

  const localeCatalogs = await Promise.all(
    Object.entries(localeCatalogPromises).map(async ([locale, promise]) => {
      const catalog = await promise;
      return [locale, catalog] as const;
    })
  );

  translationCache = new Map();

  for (const [englishStr, index] of indexMap) {
    const localeMap = new Map<string, string>();
    localeMap.set('en', englishStr);

    for (const [locale, catalog] of localeCatalogs) {
      const translated = elementToString(catalog[index]);
      if (translated !== null && translated !== englishStr) {
        localeMap.set(locale, translated);
      } else {
        // Fallback: use English if no translation or identical
        localeMap.set(locale, englishStr);
      }
    }

    translationCache.set(englishStr, localeMap);
  }

  return translationCache;
}

/**
 * Translate a navigation title for a given locale.
 * Returns the English string if no translation found.
 * Safe to call at build time (SSR) — catalogs are cached after first load.
 */
export async function translateTitle(englishTitle: string, locale: string): Promise<string> {
  if (locale === 'en') return englishTitle;

  const cache = await getTranslationCache();
  const localeMap = cache.get(englishTitle);
  return localeMap?.get(locale) ?? englishTitle;
}
