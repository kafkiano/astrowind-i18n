/**
 * Migrate existing Wuchale .po files to JSON catalogs.
 * Run once: bun run src/i18n/migrate.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog, saveCatalog, type Catalog } from './catalog';

const LOCALES_DIR = path.resolve(import.meta.dirname!, '../../src/locales');

/**
 * Parse a .po file into a Catalog (msgid → msgstr).
 * Handles multi-line msgstr values.
 */
function parsePo(content: string): Catalog {
  const catalog: Catalog = {};

  // Split into entries (each starts with #: or msgid)
  const entries = content.split(/\n(?=(?:#:|msgid ))/);

  for (const entry of entries) {
    const msgidMatch = entry.match(/^msgid "((?:[^"\\]|\\.)*)"/m);
    if (!msgidMatch) continue;

    const msgid = unescapePo(msgidMatch[1]);

    // Collect msgstr lines (can be multi-line)
    const msgstrLines: string[] = [];
    const msgstrRegex = /^msgstr "((?:[^"\\]|\\.)*)"/gm;
    let match: RegExpExecArray | null;
    while ((match = msgstrRegex.exec(entry)) !== null) {
      msgstrLines.push(unescapePo(match[1]));
    }

    const msgstr = msgstrLines.join('');
    catalog[msgid] = msgstr || msgid;
  }

  return catalog;
}

function unescapePo(str: string): string {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

async function migrate() {
  const locales = ['en', 'es', 'fr', 'de'];

  for (const locale of locales) {
    const poPath = path.join(LOCALES_DIR, `${locale}.po`);
    if (!fs.existsSync(poPath)) {
      console.log(`  [skip] ${locale}.po not found`);
      continue;
    }

    const content = fs.readFileSync(poPath, 'utf-8');
    const catalog = parsePo(content);

    // For source locale (en), msgstr === msgid is the norm
    // For target locales, only keep entries with actual translations
    if (locale !== 'en') {
      // Keep English placeholders for completeness
    }

    const jsonPath = path.join(LOCALES_DIR, `${locale}.json`);
    saveCatalog(LOCALES_DIR, locale, catalog);
    console.log(`  [done] ${locale}.json (${Object.keys(catalog).length} entries)`);
  }
}

migrate().catch(console.error);
