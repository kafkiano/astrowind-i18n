import { writeFile, mkdir } from 'node:fs/promises';
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
 * Save manifest to disk.
 */
export async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
