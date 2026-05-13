import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface LocaleEntry {
  slug: string;
  outputPath: string;
}

export interface ManifestEntry {
  sourcePath: string;
  title: string;
  locales: Record<string, LocaleEntry>;
}

export type Manifest = Record<string, ManifestEntry>;

/**
 * Load manifest from disk. Returns empty manifest if file doesn't exist.
 */
export async function loadManifest(manifestPath: string): Promise<Manifest> {
  try {
    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Save manifest to disk.
 */
export async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
