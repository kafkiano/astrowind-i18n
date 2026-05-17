/**
 * Emit translated markdown files for all locales.
 * Uses JSON translation memory (.i18n-cache/content-translations.json).
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, relative, extname, dirname } from 'node:path';
import { extract } from './markdown-extractor';
import { render } from './markdown-renderer';
import { loadMemory, saveMemory, findUntranslated, mergeMessages } from './markdown-memory';
import { translateMessages } from './markdown-translator';
import type { Manifest, ManifestEntry } from '~/types';

export interface EmitterOptions {
  sourceDir: string;
  outputDir: string;
  localesDir: string;
  locales: string[];
  sourceLocale: string;
  translatableFrontmatterKeys: string[];
  manifestPath?: string;
}

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

function getRelativeSlug(filePath: string, sourceDir: string, locales: string[]): string {
  const rel = relative(sourceDir, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length > 1 && locales.includes(parts[0])) parts.shift();
  return parts.join('/').replace(/\.(md|mdx)$/, '');
}

function getOutputRelativePath(filePath: string, sourceDir: string, locales: string[]): string {
  const rel = relative(sourceDir, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  if (parts.length > 1 && locales.includes(parts[0])) parts.shift();
  return parts.join('/');
}

async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function emitAll(options: EmitterOptions): Promise<Manifest> {
  const { sourceDir, locales, sourceLocale } = options;
  const manifestPath = options.manifestPath || join('.wuchale-content', 'manifest.json');

  const manifest: Manifest = {};
  let sourceFiles = await globMarkdown(sourceDir);

  sourceFiles = sourceFiles.filter((f) => {
    const rel = relative(sourceDir, f).replace(/\\/g, '/');
    const firstPart = rel.split('/')[0];
    if (locales.includes(firstPart)) return firstPart === sourceLocale;
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

export async function emitFile(sourcePath: string, options: EmitterOptions): Promise<ManifestEntry | null> {
  const { sourceDir, outputDir, locales, sourceLocale, translatableFrontmatterKeys } = options;

  const source = await readFile(sourcePath, 'utf-8');
  const relativePath = getOutputRelativePath(sourcePath, sourceDir, locales);
  const fileSlug = getRelativeSlug(sourcePath, sourceDir, locales);

  // 1. Extract messages and skeleton
  const { messages, skeleton } = extract(source, sourcePath, translatableFrontmatterKeys);

  // 2. Load translation memory for source locale
  const memory = await loadMemory(sourceLocale);

  // 3. Merge new messages (only if actually new)
  const newMessages = messages.map((m) => ({ msgid: m.text, references: [sourcePath] }));
  const { memory: mergedMemory, hasNew } = mergeMessages(memory, newMessages);

  if (hasNew) {
    await saveMemory(sourceLocale, mergedMemory);
  }

  // 4. Build index → text mapping for source locale
  const sourceMessageMap = new Map<number, string>();
  for (const msg of messages) {
    sourceMessageMap.set(msg.index, msg.text);
  }

  // Resolve title for manifest
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
      // Source locale: use original text
      const resolveMessage = (index: number) => sourceMessageMap.get(index) || `__W_MSG_${index}__`;
      const rendered = render(skeleton, resolveMessage);

      const outputDirForLocale = join(outputDir, locale);
      const outputPath = join(outputDirForLocale, relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered, 'utf-8');

      const slug = skeleton.frontmatter.slug || fileSlug;
      manifestEntry.locales[locale] = { slug: typeof slug === 'string' ? slug : fileSlug, outputPath };
    } else {
      // Target locale: load target locale's own memory
      const targetMemory = await loadMemory(locale);
      
      // Merge source messages into target memory
      const { memory: mergedTarget, hasNew: targetHasNew } = mergeMessages(targetMemory, newMessages);
      
      // Find untranslated in target memory
      const untranslated = findUntranslated(mergedTarget);

      if (untranslated.length > 0) {
        const translations = await translateMessages({
          sourceLocale,
          targetLocale: locale,
          messages: untranslated.map((m) => ({ msgid: m.msgid, msgstr: m.msgstr })),
        });

        // Update target memory with translations
        for (const [msgid, msgstr] of translations) {
          const entry = mergedTarget.get(msgid);
          if (entry) entry.msgstr = msgstr;
        }
        await saveMemory(locale, mergedTarget);
      } else if (targetHasNew) {
        await saveMemory(locale, mergedTarget);
      }

      // Build locale-specific message map from target memory
      const localeMessageMap = new Map<number, string>();
      for (const msg of messages) {
        const entry = mergedTarget.get(msg.text);
        localeMessageMap.set(msg.index, entry?.msgstr || msg.text);
      }

      const resolveMessage = (index: number) => localeMessageMap.get(index) || `__W_MSG_${index}__`;
      const rendered = render(skeleton, resolveMessage);

      const outputDirForLocale = join(outputDir, locale);
      const outputPath = join(outputDirForLocale, relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered, 'utf-8');

      const slug = skeleton.frontmatter.slug || fileSlug;
      manifestEntry.locales[locale] = { slug: typeof slug === 'string' ? slug : fileSlug, outputPath };
    }
  }

  return manifestEntry;
}
