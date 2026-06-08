/**
 * JSON-based translation catalog management.
 *
 * One JSON file per locale in src/locales/{locale}.json.
 * Format: { "English string": "Translated string" }
 *
 * Supports: load, save, merge extracted strings, AI translation hooks.
 * All I/O is async (fs/promises) — consistent with the rest of the i18n pipeline.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type Catalog = Record<string, string>;

export interface CatalogSet {
  [locale: string]: Catalog;
}

/** Load a single locale catalog from disk */
export async function loadCatalog(localesDir: string, locale: string): Promise<Catalog> {
  const filePath = path.join(localesDir, `${locale}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Catalog;
  } catch {
    return {};
  }
}

/** Load all locale catalogs from disk (in parallel) */
export async function loadAllCatalogs(localesDir: string, locales: string[]): Promise<CatalogSet> {
  const entries = await Promise.all(
    locales.map(async (locale) => [locale, await loadCatalog(localesDir, locale)] as const)
  );
  return Object.fromEntries(entries);
}

/** Save a single locale catalog to disk */
export async function saveCatalog(localesDir: string, locale: string, catalog: Catalog): Promise<void> {
  await mkdir(localesDir, { recursive: true });
  const filePath = path.join(localesDir, `${locale}.json`);
  // Sort keys for readable diffs
  const sorted: Catalog = {};
  for (const key of Object.keys(catalog).sort()) {
    sorted[key] = catalog[key];
  }
  await writeFile(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

