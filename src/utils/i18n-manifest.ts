/**
 * Content-addressable translation manifest.
 *
 * Tracks SHA-256 hashes of source content to determine whether
 * re-translation is actually needed. Avoids calling translation APIs
 * when nothing has changed (git-safe — not mtime-based).
 *
 * Manifest file: src/locales/.i18n-manifest.json
 *
 * Structure:
 *   { "markdown": { "src/data/post/en/foo.md": "abc123", ... },
 *     "catalogs": { "en": "def456", "es": "...", ... } }
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const MANIFEST_PATH = 'src/locales/.i18n-manifest.json';

export interface Manifest {
  markdown: Record<string, string>;
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
    return { markdown: {}, catalogs: {} };
  }
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  await mkdir(join(MANIFEST_PATH, '..'), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Returns true if the source content has changed since last translation.
 * `path` is the logical key (e.g. "src/data/post/en/foo.md").
 */
export async function needsTranslation(manifest: Manifest, key: string, content: string): Promise<boolean> {
  const h = hashContent(content);
  return manifest.markdown[key] !== h;
}

/**
 * Record that a source file has been translated (stores its hash).
 */
export async function markTranslated(manifest: Manifest, key: string, content: string): Promise<Manifest> {
  const h = hashContent(content);
  if (manifest.markdown[key] === h) return manifest; // no change
  return { ...manifest, markdown: { ...manifest.markdown, [key]: h } };
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

/**
 * Remove a markdown entry from the manifest (when source file is deleted).
 */
export function removeMarkdownEntry(manifest: Manifest, key: string): Manifest {
  if (!(key in manifest.markdown)) return manifest;
  const rest = { ...manifest.markdown };
  delete rest[key];
  return { ...manifest, markdown: rest };
}
