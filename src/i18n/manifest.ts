/**
 * Content-addressable translation manifest for the catalog.
 *
 * Tracks the SHA-256 hash of the source catalog to determine whether
 * catalog gap-translation is actually needed. Avoids calling translation
 * APIs when nothing has changed (git-safe — not mtime-based).
 *
 * Manifest file: src/locales/.i18n-manifest.json
 * Structure: { "catalogs": { "en": "def456", "es": "...", ... } }
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const MANIFEST_PATH = 'src/locales/.i18n-manifest.json';

export interface Manifest {
  catalogs: Record<string, string>;
}

/** SHA-256 hex digest of a string. */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function loadManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { catalogs: {} };
  }
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  await mkdir(join(MANIFEST_PATH, '..'), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Check whether the source catalog has changed since last catalog translation pass.
 * `catalogJson` is the raw string content of the source locale catalog.
 * `sourceLocale` is the key used in the manifest (e.g. 'en', 'de').
 */
export function catalogNeedsTranslation(manifest: Manifest, catalogJson: string, sourceLocale: string): boolean {
  const h = hashContent(catalogJson);
  return manifest.catalogs[sourceLocale] !== h;
}

/**
 * Mark catalog translation as done for the current source catalog state.
 */
export function markCatalogTranslated(manifest: Manifest, catalogJson: string, sourceLocale: string): Manifest {
  const h = hashContent(catalogJson);
  return { ...manifest, catalogs: { ...manifest.catalogs, [sourceLocale]: h } };
}
