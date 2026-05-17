/**
 * I18n runtime — virtual module providing the _t() translation function.
 *
 * During SSR/build, _t(msgid) returns the translation for the current locale.
 * The locale is set once per request by Layout.astro via setLocale().
 *
 * The catalog is loaded at module init time (build/SSR only).
 */

import { loadAllCatalogs, type CatalogSet } from './catalog';
import { locales } from '../locales/data';

// ── Locale state ─────────────────────────────────────────────────────────

let currentLocale = 'en';

export function setLocale(locale: string): void {
  currentLocale = locale;
}

export function getLocale(): string {
  return currentLocale;
}

// ── Catalog ──────────────────────────────────────────────────────────────

let catalogs: CatalogSet | null = null;

function getCatalogs(): CatalogSet {
  if (!catalogs) {
    // Resolve locales dir relative to this module's location
    catalogs = loadAllCatalogs('src/locales', locales);
  }
  return catalogs;
}

// ── Translation function ─────────────────────────────────────────────────

/**
 * Translate a string to the current locale.
 * Falls back to English (msgid) if no translation exists.
 */
export function _t(msgid: string): string {
  if (currentLocale === 'en') return msgid;

  const cats = getCatalogs();
  const translated = cats[currentLocale]?.[msgid];
  if (translated && translated !== msgid) return translated;

  // Fallback: return English
  return msgid;
}

/**
 * Plural-aware translation stub (for future use).
 */
export function _tn(singular: string, plural: string, count: number): string {
  if (count === 1) return _t(singular);
  return _t(plural);
}
