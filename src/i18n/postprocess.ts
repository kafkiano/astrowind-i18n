/**
 * HTML post-processing: walks dist/ output, replaces English strings
 * with translations from JSON catalogs for non-English locale pages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogSet } from './catalog';

/** Decode common HTML entities to their character equivalents. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Replace English text content in HTML with catalog translations.
 * Only translates COMPLETE text segments between HTML tags — no
 * substring tokenization. Handles HTML entity encoding mismatches.
 */
export function translateHtml(html: string, locale: string, catalogs: CatalogSet): string {
  if (locale === 'en') return html;

  const targetCatalog = catalogs[locale];
  if (!targetCatalog) return html;

  return html.replace(/>([^<]*)</g, (match, textBetween: string) => {
    const trimmed = textBetween.trim();
    if (!trimmed) return match;

    // Try exact match first, then entity-decoded match
    let translation = targetCatalog[trimmed];
    if (!translation || translation === trimmed) {
      const decoded = decodeEntities(trimmed);
      if (decoded !== trimmed) {
        translation = targetCatalog[decoded];
      }
    }

    if (translation && translation !== trimmed) {
      const leading = textBetween.match(/^\s*/)?.[0] ?? '';
      const trailing = textBetween.match(/\s*$/)?.[0] ?? '';
      return `>${leading}${translation}${trailing}<`;
    }

    return match;
  });
}

/** Walk a directory recursively, visiting .html files. */
export function walkHtmlFiles(dir: string, visitor: (filePath: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, visitor);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      visitor(fullPath);
    }
  }
}

/**
 * Post-process the entire build output directory: translate HTML for
 * all non-English locale pages. Called from astro:build:done hook.
 */
export function postProcessBuild(dir: URL, catalogs: CatalogSet): void {
  const distDir = fileURLToPath(dir);
  console.log(`[i18n] Post-processing HTML in ${distDir}...`);

  let processed = 0;
  let translated = 0;

  walkHtmlFiles(distDir, (filePath: string) => {
    // Determine locale from path: /dist/de/pricing/index.html → de
    const relPath = path.relative(distDir, filePath);
    const localeMatch = relPath.match(/^([a-z]{2})\//);
    if (!localeMatch) return;

    const locale = localeMatch[1];
    if (locale === 'en') return;

    processed++;
    try {
      const html = fs.readFileSync(filePath, 'utf-8');
      const translatedHtml = translateHtml(html, locale, catalogs);
      if (translatedHtml !== html) {
        fs.writeFileSync(filePath, translatedHtml, 'utf-8');
        translated++;
      }
    } catch (err) {
      console.warn(`[i18n] Failed: ${relPath} — ${(err as Error).message}`);
    }
  });

  console.log(`[i18n] Done: ${translated}/${processed} pages translated`);
}
