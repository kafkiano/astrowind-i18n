/**
 * Astro integration for i18n.
 *
 * Orchestrates the unified string-translation pipeline:
 *   1. Extract translatable strings from .astro, config.yaml, and source-locale
 *      markdown (frontmatter leaves + whole bodies) → source catalog
 *   2. Prune dead strings + sync new keys to target locale catalogs
 *   3. Translate catalog gaps (HTML batch for UI/frontmatter, plain-text for bodies)
 *   4. Post-process HTML output (replace source-locale UI text with translations)
 *
 * Content collections (templates, pages, snippets, post) are rendered per-locale
 * by the virtual content loader (src/i18n/virtual-loader.ts), which substitutes
 * from this catalog at build time. No physical per-locale markdown files exist.
 *
 * All I/O is async (fs/promises) — consistent with the rest of the pipeline.
 */

import type { AstroIntegration } from 'astro';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { readConfig } from './config';
import { loadAllCatalogs, loadCatalog, saveCatalog, type CatalogSet } from './catalog';
import { extractFromAstro, extractFromConfig } from './extract';
import { getProvider } from './provider';
import { translateHtml } from './postprocess';
import { splitFrontmatter, collectTranslatableStrings } from './markdown';
import { glob } from 'tinyglobby';

/** Decode common HTML entities to their character equivalents. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Escape a string for safe inclusion in a regular expression. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function i18nIntegration(): AstroIntegration {
  let catalogs: CatalogSet;
  let defaultLocale: string;
  let activeLocales: Set<string>;
  let localeRegex: RegExp;

  return {
    name: 'astrowind-i18n',
    hooks: {
      'astro:config:setup': async () => {
        const config = readConfig();
        const { locales } = config;
        const srcLocale = config.defaultLocale;
        defaultLocale = srcLocale;
        activeLocales = new Set(locales);
        activeLocales.add(srcLocale);
        localeRegex = new RegExp(
          '^(' +
            [...activeLocales]
              .sort((a, b) => b.length - a.length)
              .map(escapeRegExp)
              .join('|') +
            ')\\/'
        );

        // ── Extract strings from .astro files ────────────────────────

        const astroFiles = await glob('src/**/*.astro', { ignore: ['src/locales/**', 'node_modules/**'] });
        const activeStrings = new Set<string>();

        for (const file of astroFiles) {
          try {
            const content = await readFile(file, 'utf-8');
            const extracted = await extractFromAstro(content, file);
            for (const item of extracted) {
              const msgid = decodeEntities(item.msgid.replace(/\s+/g, ' ').trim());
              if (msgid) activeStrings.add(msgid);
            }
          } catch (err) {
            console.warn(`[i18n] Skipped ${file}: ${(err as Error).message}`);
          }
        }

        // ── Extract strings from config.yaml ─────────────────────────

        try {
          const configPath = path.resolve('src/config.yaml');
          const configRaw = await readFile(configPath, 'utf-8');
          const fullConfig = yaml.load(configRaw) as Record<string, unknown>;
          const configStrings = extractFromConfig(fullConfig);
          for (const str of configStrings) {
            const normalized = decodeEntities(str.replace(/\s+/g, ' ').trim());
            if (normalized) activeStrings.add(normalized);
          }
        } catch (err) {
          console.warn(`[i18n] Failed to extract config strings: ${(err as Error).message}`);
        }

        // ── Extract frontmatter + body strings from source-locale markdown ──
        // Frontmatter leaves ride the existing UI-string flow (HTML-tag batch).
        // Bodies are whole-block strings translated via plain text (preserveFormatting,
        // no HTML tag handling) — tracked in `bodyStrings` to route them at translation time.

        const catalogContentTypes = [
          { dir: 'src/data/templates', pattern: '**/*.md' },
          { dir: 'src/data/pages', pattern: '**/*.md' },
          { dir: 'src/data/snippets', pattern: '**/*.md' },
          { dir: 'src/data/post', pattern: '**/*.md' },
        ];

        const bodyStrings = new Set<string>();

        for (const { dir, pattern } of catalogContentTypes) {
          const srcDir = path.join(dir, srcLocale);
          try {
            const files = await glob(pattern, { cwd: srcDir });
            for (const relPath of files) {
              try {
                const filePath = path.join(srcDir, relPath);
                const content = await readFile(filePath, 'utf-8');
                const { frontmatter, body } = splitFrontmatter(content);
                if (frontmatter.trim()) {
                  const fmObj = yaml.load(frontmatter);
                  if (fmObj && typeof fmObj === 'object') {
                    for (const { value } of collectTranslatableStrings(fmObj)) {
                      const normalized = decodeEntities(value.replace(/\s+/g, ' ').trim());
                      if (normalized) activeStrings.add(normalized);
                    }
                  }
                }
                // Whole body = ONE catalog key. Preserve newlines/structure (no whitespace
                // collapse) so the Phase 2 virtual loader can look it up verbatim.
                const bodyKey = decodeEntities(body.trim());
                if (bodyKey) {
                  activeStrings.add(bodyKey);
                  bodyStrings.add(bodyKey);
                }
              } catch (err) {
                console.warn(`[i18n] Skipped markdown ${dir}/${srcLocale}/${relPath}: ${(err as Error).message}`);
              }
            }
          } catch {
            // Source locale dir may not exist — skip silently
          }
        }

        // ── Prune dead strings + merge new into source catalog ──────

        const srcCatalog = await loadCatalog('src/locales', srcLocale);
        let newStrings = 0;
        let removedStrings = 0;

        // Find dead strings (in catalog but no longer in any .astro file)
        const deadStrings: string[] = [];
        for (const key of Object.keys(srcCatalog)) {
          if (!activeStrings.has(key)) {
            deadStrings.push(key);
          }
        }
        if (deadStrings.length > 0) {
          for (const key of deadStrings) {
            delete srcCatalog[key];
          }
          removedStrings = deadStrings.length;
        }

        // Merge in new strings
        for (const t of activeStrings) {
          const text = decodeEntities(t);
          if (!text || text in srcCatalog) continue;
          srcCatalog[text] = ''; // placeholder: untranslated
          newStrings++;
        }

        if (newStrings > 0 || removedStrings > 0) {
          await saveCatalog('src/locales', srcLocale, srcCatalog);
          const parts: string[] = [];
          if (newStrings > 0) parts.push(`${newStrings} new`);
          if (removedStrings > 0) parts.push(`${removedStrings} removed`);
          console.log(`[i18n] ${parts.join(', ')} strings in ${srcLocale}.json`);
        }

        // ── Sync changes to target locale catalogs ───────────────────

        for (const locale of locales) {
          if (locale === srcLocale) continue;
          const targetCatalog = await loadCatalog('src/locales', locale);
          let synced = 0;

          // Add new keys (from source catalog) with empty placeholder
          for (const [key] of Object.entries(srcCatalog)) {
            if (!(key in targetCatalog)) {
              targetCatalog[key] = '';
              synced++;
            }
          }

          // Remove dead keys no longer in source catalog
          for (const key of Object.keys(targetCatalog)) {
            if (!(key in srcCatalog)) {
              delete targetCatalog[key];
              synced++;
            }
          }

          if (synced > 0) {
            await saveCatalog('src/locales', locale, targetCatalog);
          }
        }

        // ── Clean up removed locales ─────────────────────────────────

        await cleanRemovedLocaleDirs(activeLocales);

        // ── Translation ─────────────────────────────────────────────

        const provider = await getProvider();
        if (provider) {
          // Translate catalog gaps: UI/frontmatter via HTML batch, bodies via plain text.
          let hasGaps = false;
          for (const locale of locales) {
            if (locale === srcLocale) continue;
            const cat = await loadCatalog('src/locales', locale);
            if (Object.keys(cat).some((k) => cat[k] === '')) {
              hasGaps = true;
              break;
            }
          }

          if (hasGaps) {
            let totalTranslated = 0;
            for (const locale of locales) {
              if (locale === srcLocale) continue;
              try {
                const catalog = await loadCatalog('src/locales', locale);
                const untranslated = Object.keys(catalog).filter((k) => catalog[k] === '');
                if (untranslated.length === 0) continue;

                // Route body strings through plain-text translation (preserveFormatting,
                // no HTML tag handling — markdown bodies are not HTML). UI/frontmatter
                // strings go through the HTML-tag batch. Both write back to the same catalog.
                const bodyKeys = untranslated.filter((k) => bodyStrings.has(k));
                const otherKeys = untranslated.filter((k) => !bodyStrings.has(k));
                let localeTranslated = 0;
                if (otherKeys.length > 0) {
                  const other = await provider.translateBatch(otherKeys, locale, srcLocale);
                  for (let i = 0; i < otherKeys.length; i++) {
                    if (other[i]) {
                      catalog[otherKeys[i]] = other[i];
                      localeTranslated++;
                    }
                  }
                }
                if (bodyKeys.length > 0) {
                  const bodies = await provider.translatePlainTextBatch(bodyKeys, locale, srcLocale);
                  for (let i = 0; i < bodyKeys.length; i++) {
                    if (bodies[i]) {
                      catalog[bodyKeys[i]] = bodies[i];
                      localeTranslated++;
                    }
                  }
                }
                if (localeTranslated > 0) {
                  await saveCatalog('src/locales', locale, catalog);
                  totalTranslated += localeTranslated;
                  console.log(`[i18n] ${provider.name} translated ${localeTranslated} strings to ${locale}`);
                }
              } catch {
                // Translation failure shouldn't block the build
              }
            }
            if (totalTranslated > 0) {
              console.log(`[i18n] ${provider.name}: ${totalTranslated} total translations across all locales`);
            }

            // If gaps remain (e.g. provider error), they stay as "" and retry on the next build.
            for (const locale of locales) {
              if (locale === srcLocale) continue;
              const cat = await loadCatalog('src/locales', locale);
              if (Object.keys(cat).some((k) => cat[k] === '')) {
                console.log('[i18n] Some strings still untranslated — will retry on next build');
                break;
              }
            }
          }
        }

        // ── Load catalogs for post-processing ────────────────────────

        catalogs = await loadAllCatalogs('src/locales', locales);
        console.log(`[i18n] Loaded catalogs for: ${Object.keys(catalogs).join(', ')}`);
      },

      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        console.log(`[i18n] Post-processing HTML in ${distDir}...`);

        let processed = 0;
        let translated = 0;

        await walkHtmlFiles(distDir, async (filePath: string) => {
          const relPath = path.relative(distDir, filePath);
          const localeMatch = relPath.match(localeRegex);
          if (!localeMatch) return;

          const locale = localeMatch[1];
          if (locale === defaultLocale) return;

          processed++;
          try {
            const html = await readFile(filePath, 'utf-8');
            const translatedHtml = translateHtml(html, locale, catalogs, defaultLocale);
            if (translatedHtml !== html) {
              await writeFile(filePath, translatedHtml, 'utf-8');
              translated++;
            }
          } catch (err) {
            console.warn(`[i18n] Failed: ${relPath} — ${(err as Error).message}`);
          }
        });

        console.log(`[i18n] Done: ${translated}/${processed} pages translated`);
      },
    },
  };
}

/** Walk a directory recursively, visiting .html files (async). */
async function walkHtmlFiles(dir: string, visitor: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkHtmlFiles(fullPath, visitor);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      await visitor(fullPath);
    }
  }
}

/**
 * Warn about stale locale directories (from locales that were removed
 * from config.yaml). Does NOT auto-delete — manual cleanup is safer.
 */
async function cleanRemovedLocaleDirs(activeLocales: Set<string>): Promise<void> {
  // Check catalog files for removed locales
  try {
    const catalogEntries = await readdir('src/locales', { withFileTypes: true });
    for (const entry of catalogEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      if (entry.name.startsWith('.')) continue; // skip hidden files
      const locale = entry.name.replace(/\.json$/, '');
      if (activeLocales.has(locale)) continue;
      console.warn(`[i18n] Stale catalog file (not in config.yaml locales): src/locales/${entry.name}`);
    }
  } catch {
    // src/locales might not exist yet — ignore
  }
}
