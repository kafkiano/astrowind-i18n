/**
 * Virtual content loader for i18n markdown collections.
 *
 * Replaces the `glob` loader for the pure-.md content collections (templates,
 * pages, snippets). Instead of reading physical per-locale markdown files, it
 * reads the SOURCE-locale files and synthesizes one virtual entry per locale by
 * substituting translatable strings from the shared source-text-as-key catalog
 * (populated by the i18n integration's extract → sync → translate pass, which
 * runs in astro:config:setup before content load).
 *
 * Non-translatable frontmatter fields (image paths, URLs, icons, enums) pass
 * through verbatim from the source — so a CMS image-swap in the source file
 * propagates to every locale with ZERO translation cost. This is the fix for
 * the Sveltia image-URL bug.
 *
 * Uses LoaderContext.renderMarkdown() (Astro 5.9+) for the same markdown
 * processing (remark/rehype plugins) as the glob loader — verified byte-identical
 * in the POC-0 spike.
 *
 * The `post` collection (MDX) stays on the physical `glob` loader (deferred).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { glob } from 'tinyglobby';
import type { Loader } from 'astro/loaders';
import { readConfig } from './config';
import { loadAllCatalogs, type CatalogSet } from './catalog';
import { splitFrontmatter, collectTranslatableStrings, setValueAtPath } from './markdown';

/**
 * Decode common HTML entities — MUST stay identical to the extraction in
 * src/i18n/integration.ts so catalog keys produced here match those looked up.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Normalize a frontmatter leaf string to its catalog key form (matches extraction). */
const normalizeKey = (s: string): string => decodeEntities(s.replace(/\s+/g, ' ').trim());

/**
 * Build a virtual loader for a markdown content collection.
 *
 * @param base - the collection's source directory, e.g. 'src/data/templates'.
 *               Source-locale files are read from `${base}/${defaultLocale}/*.md`.
 */
export function virtualLoader({ base }: { base: string }): Loader {
  return {
    name: `i18n-virtual:${base}`,
    async load({ store, parseData, renderMarkdown, generateDigest, logger }) {
      if (!renderMarkdown) {
        logger.error('LoaderContext.renderMarkdown unavailable (requires Astro 5.9+)');
        store.clear();
        return;
      }

      const { locales, defaultLocale } = readConfig();
      const srcDir = path.join(base, defaultLocale);

      // Source dir may not exist for a collection — glob resolves to null then.
      const files = await glob('**/*.md', { cwd: srcDir }).catch(() => null);
      if (!files) {
        store.clear();
        return;
      }

      // Catalogs are populated by the i18n integration's astro:config:setup
      // (extraction + sync + translation), which runs before content load.
      let catalogs: CatalogSet;
      try {
        catalogs = await loadAllCatalogs('src/locales', locales);
      } catch {
        catalogs = {};
      }

      store.clear();

      for (const relPath of files) {
        const srcAbsPath = path.resolve(path.join(srcDir, relPath));
        let content: string;
        try {
          content = await readFile(srcAbsPath, 'utf-8');
        } catch (err) {
          logger.warn(`Failed to read ${srcAbsPath}: ${(err as Error).message}`);
          continue;
        }

        const { frontmatter, body } = splitFrontmatter(content);
        const loaded = frontmatter.trim() ? yaml.load(frontmatter) : {};
        const fm = loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {};

        // Translatable leaves (paths + source values) — computed once per file.
        const translatable = collectTranslatableStrings(fm);
        // Whole body as ONE catalog key (preserve newlines — no whitespace collapse).
        const bodyKey = decodeEntities(body.trim());

        for (const locale of locales) {
          const catalog = catalogs[locale] || {};
          const tr = (src: string): string | null => {
            if (!src) return null;
            const t = catalog[normalizeKey(src)];
            return t && t !== '' ? t : null;
          };

          // ── Frontmatter: substitute translatable leaves from the catalog;
          //    non-translatable fields (image paths, hrefs, icons, enums) pass
          //    through from the source unchanged. ──
          const data = fm ? (structuredClone(fm) as Record<string, unknown>) : {};
          for (const { path: leafPath, value } of translatable) {
            const translated = tr(value);
            if (translated !== null) setValueAtPath(data, leafPath, translated);
          }

          // ── Body: look up the whole-body translation; fall back to source. ──
          let translatedBody = body;
          if (bodyKey) {
            const t = catalog[bodyKey];
            if (t && t !== '') translatedBody = t;
          }

          // ── Render the (possibly translated) body with the project's full
          //    markdown pipeline (remark/rehype plugins) via renderMarkdown. ──
          const rendered = await renderMarkdown(translatedBody, {
            fileURL: new URL('file://' + srcAbsPath),
          });

          // Match glob's metadata.frontmatter shape: YAML frontmatter + plugin
          // additions (e.g. readingTime). Plugin values (already in rendered) win.
          if (rendered?.metadata) {
            rendered.metadata.frontmatter = {
              ...(data as object),
              ...(rendered.metadata.frontmatter ?? {}),
            };
          }

          const id = `${locale}/${relPath.replace(/\.md$/, '')}`;
          const validated = await parseData({ id, data });

          store.set({
            id,
            data: validated,
            body: translatedBody,
            filePath: path.join(base, defaultLocale, relPath),
            digest: generateDigest(JSON.stringify(validated) + translatedBody),
            rendered,
          });
        }
      }
    },
  };
}
