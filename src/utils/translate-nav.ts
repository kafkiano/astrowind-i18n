/**
 * Build-time translation for navigation titles.
 *
 * Uses JSON catalogs (src/locales/{locale}.json) to translate navigation
 * titles at build time. Replaces the Wuchale-catalog-based approach.
 */

import { loadAllCatalogs, translate, type CatalogSet } from '~/i18n/catalog';
import { locales } from '../locales/data';

/** Loaded once at module init */
let catalogs: CatalogSet | null = null;

function getCatalogs(): CatalogSet {
  if (!catalogs) {
    catalogs = loadAllCatalogs('src/locales', locales);
  }
  return catalogs;
}

/**
 * Translate a navigation title for a given locale.
 * Returns the English string if no translation found.
 * Synchronous — catalogs are loaded at module init.
 */
export function translateTitle(englishTitle: string, locale: string): string {
  if (locale === 'en') return englishTitle;
  return translate(getCatalogs(), locale, englishTitle);
}
