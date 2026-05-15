import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, relative, extname, dirname } from 'node:path';
import { extract } from './markdown-extractor';
import { render } from './markdown-renderer';
import { loadPO, savePO, findUntranslated, mergeMessages } from './markdown-po';
import { translateMessages } from './markdown-translator';
import type { Manifest, ManifestEntry } from '~/types';

export interface EmitterOptions {
  sourceDir: string; // e.g. 'src/data/pages'
  outputDir: string; // e.g. '.wuchale-content/pages'
  localesDir: string; // e.g. 'src/locales'
  locales: string[]; // e.g. ['en', 'es', 'fr', 'de']
  sourceLocale: string; // e.g. 'en'
  translatableFrontmatterKeys: string[];
  manifestPath?: string; // default: '.wuchale-content/manifest.json'
}

/**
 * Glob all .md files in a directory recursively.
 */
async function globMarkdown(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && (extname(entry.name) === '.md' || extname(entry.name) === '.mdx')) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Get the relative path from sourceDir to a file, without extension.
 * Strips locale prefix if present (e.g., 'en/about.md' → 'about').
 */
function getRelativeSlug(filePath: string, sourceDir: string, locales: string[]): string {
  const rel = relative(sourceDir, filePath).replace(/\\/g, '/');
  // Strip locale prefix if present
  const parts = rel.split('/');
  if (parts.length > 1 && locales.includes(parts[0])) {
    parts.shift();
  }
  return parts.join('/').replace(/\.(md|mdx)$/, '');
}

/**
 * Get the relative path for output, stripping locale prefix from source.
 */
function getOutputRelativePath(filePath: string, sourceDir: string, locales: string[]): string {
  const rel = relative(sourceDir, filePath).replace(/\\/g, '/');
  // Strip locale prefix if present
  const parts = rel.split('/');
  if (parts.length > 1 && locales.includes(parts[0])) {
    parts.shift();
  }
  return parts.join('/');
}

/**
 * Emit all locale files for all source markdown files.
 */
export async function emitAll(options: EmitterOptions): Promise<Manifest> {
  const { sourceDir, locales, sourceLocale } = options;
  const manifestPath = options.manifestPath || join('.wuchale-content', 'manifest.json');

  const manifest: Manifest = {};
  let sourceFiles = await globMarkdown(sourceDir);

  // Filter to only process files from the source locale directory
  // If files are in locale subdirs (e.g., en/, es/), only process the source locale
  sourceFiles = sourceFiles.filter((f) => {
    const rel = relative(sourceDir, f).replace(/\\/g, '/');
    const firstPart = rel.split('/')[0];
    // If the first directory is a locale, only include source locale files
    if (locales.includes(firstPart)) {
      return firstPart === sourceLocale;
    }
    // If no locale prefix, include the file
    return true;
  });

  for (const sourcePath of sourceFiles) {
    const entry = await emitFile(sourcePath, options);
    if (entry) {
      const key = getRelativeSlug(sourcePath, sourceDir, locales);
      manifest[key] = entry;
    }
  }

  await saveManifest(manifestPath, manifest);
  return manifest;
}

/**
 * Emit locale files for a single source markdown file.
 * Returns the manifest entry, or null if the file should be skipped.
 */
export async function emitFile(sourcePath: string, options: EmitterOptions): Promise<ManifestEntry | null> {
  const { sourceDir, outputDir, localesDir, locales, sourceLocale, translatableFrontmatterKeys } = options;

  const source = await readFile(sourcePath, 'utf-8');
  const relativePath = getOutputRelativePath(sourcePath, sourceDir, locales);
  const fileSlug = getRelativeSlug(sourcePath, sourceDir, locales);

  // 1. Extract messages and skeleton
  const { messages, skeleton } = extract(source, sourcePath, translatableFrontmatterKeys);

  // 2. Load source locale PO file
  const sourcePoPath = join(localesDir, `${sourceLocale}.po`);
  const sourcePo = await loadPO(sourcePoPath);

  // 3. Merge new messages into source PO (source msgstr = msgid)
  const newMessages = messages.map((m) => ({
    msgid: m.text,
    references: [sourcePath],
  }));

  const { merged: mergedSourcePo } = mergeMessages(sourcePo, newMessages);

  // For source locale, msgstr = msgid (identity translation)
  for (const msg of mergedSourcePo.values()) {
    if (!msg.msgstr || msg.msgstr === '') {
      msg.msgstr = msg.msgid;
    }
  }

  await savePO(sourcePoPath, mergedSourcePo, sourceLocale, sourceLocale);

  // 4. Build message index → text mapping for source
  const sourceMessageMap = new Map<number, string>();
  for (const msg of messages) {
    sourceMessageMap.set(msg.index, msg.text);
  }

  // 5. For each locale, generate the translated file
  // Resolve the actual title (not sentinel) for the manifest
  const titleSentinel = typeof skeleton.frontmatter.title === 'string' ? skeleton.frontmatter.title : '';
  const titleIndex = titleSentinel.startsWith('__W_MSG_') ? parseInt(titleSentinel.match(/\d+/)?.[0] || '0') : -1;
  const resolvedTitle = titleIndex >= 0 ? sourceMessageMap.get(titleIndex) || '' : titleSentinel;

  const manifestEntry: ManifestEntry = {
    sourcePath,
    title: resolvedTitle,
    locales: {},
  };

  for (const locale of locales) {
    const isSource = locale === sourceLocale;

    if (isSource) {
      // Source locale: use original text directly
      const resolveMessage = (index: number) => sourceMessageMap.get(index) || `__W_MSG_${index}__`;
      const rendered = render(skeleton, resolveMessage);

      const outputDirForLocale = join(outputDir, locale);
      const outputPath = join(outputDirForLocale, relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered, 'utf-8');

      // Get slug from frontmatter or use file path
      const slug = skeleton.frontmatter.slug || fileSlug;
      manifestEntry.locales[locale] = {
        slug: typeof slug === 'string' ? slug : fileSlug,
        outputPath,
      };
    } else {
      // Target locale: load PO, find untranslated, translate
      const targetPoPath = join(localesDir, `${locale}.po`);
      const targetPo = await loadPO(targetPoPath);

      // Merge source messages into target PO
      const { merged: mergedTargetPo } = mergeMessages(
        targetPo,
        messages.map((m) => ({ msgid: m.text, references: [sourcePath] }))
      );

      // Find untranslated messages
      const untranslated = findUntranslated(mergedTargetPo);

      if (untranslated.length > 0) {
        // Translate untranslated messages
        const translations = await translateMessages({
          sourceLocale,
          targetLocale: locale,
          messages: untranslated.map((m) => ({ msgid: m.msgid, msgstr: m.msgstr })),
        });

        // Update PO with translations
        for (const [msgid, msgstr] of translations) {
          const existing = mergedTargetPo.get(msgid);
          if (existing) {
            existing.msgstr = msgstr;
          }
        }

        // Save updated PO
        await savePO(targetPoPath, mergedTargetPo, locale, sourceLocale);
      }

      // Build resolve function for this locale
      const resolveMessage = (index: number): string => {
        const sourceText = sourceMessageMap.get(index);
        if (!sourceText) return `__W_MSG_${index}__`;

        const translated = mergedTargetPo.get(sourceText);
        return translated?.msgstr || sourceText;
      };

      const rendered = render(skeleton, resolveMessage);

      const outputDirForLocale = join(outputDir, locale);
      const outputPath = join(outputDirForLocale, relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered, 'utf-8');

      // Get translated slug or fall back to source slug
      const slugValue = skeleton.frontmatter.slug || fileSlug;
      const slugKey = typeof slugValue === 'string' ? slugValue : fileSlug;
      const slugTranslation = mergedTargetPo.get(slugKey);
      const translatedSlug = slugTranslation?.msgstr || fileSlug;

      manifestEntry.locales[locale] = {
        slug: translatedSlug || fileSlug,
        outputPath,
      };
    }
  }

  return manifestEntry;
}

/**
 * Save manifest to disk.
 */
export async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}
