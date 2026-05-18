/**
 * JSON-based translation catalog management.
 *
 * One JSON file per locale in src/locales/{locale}.json.
 * Format: { "English string": "Translated string" }
 *
 * Supports: load, save, merge extracted strings, AI translation hooks.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ExtractedString } from './extract';

export type Catalog = Record<string, string>;

export interface CatalogSet {
  [locale: string]: Catalog;
}

/** Load a single locale catalog from disk */
export function loadCatalog(localesDir: string, locale: string): Catalog {
  const filePath = path.join(localesDir, `${locale}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Catalog;
  } catch {
    return {};
  }
}

/** Load all locale catalogs from disk */
export function loadAllCatalogs(localesDir: string, locales: string[]): CatalogSet {
  const set: CatalogSet = {};
  for (const locale of locales) {
    set[locale] = loadCatalog(localesDir, locale);
  }
  return set;
}

/** Save a single locale catalog to disk */
export function saveCatalog(localesDir: string, locale: string, catalog: Catalog): void {
  fs.mkdirSync(localesDir, { recursive: true });
  const filePath = path.join(localesDir, `${locale}.json`);
  // Sort keys for readable diffs
  const sorted: Catalog = {};
  for (const key of Object.keys(catalog).sort()) {
    sorted[key] = catalog[key];
  }
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

/**
 * Merge newly extracted strings into the source locale catalog.
 * Existing translations are preserved; new entries get the msgid as placeholder.
 */
export function mergeExtracted(catalog: Catalog, extracted: ExtractedString[]): { catalog: Catalog; newCount: number } {
  let newCount = 0;
  for (const item of extracted) {
    // Normalize whitespace: collapse \s+ to single space, trim
    const msgid = item.msgid.replace(/\s+/g, ' ').trim();
    if (!msgid || msgid in catalog) continue;
    catalog[msgid] = msgid; // placeholder: English
    newCount++;
  }
  return { catalog, newCount };
}

/**
 * Get untranslated strings for a target locale (where msgid === msgstr).
 */
export function getUntranslated(catalog: Catalog): string[] {
  return Object.entries(catalog)
    .filter(([key, value]) => key === value)
    .map(([key]) => key);
}

/**
 * Look up a translation. Falls back to the msgid.
 */
export function translate(catalogs: CatalogSet, locale: string, msgid: string): string {
  if (locale === 'en') return msgid; // source locale
  return catalogs[locale]?.[msgid] || catalogs['en']?.[msgid] || msgid;
}
