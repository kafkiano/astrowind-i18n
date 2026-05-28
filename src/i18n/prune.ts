/**
 * Prune dead strings from locale catalogs.
 *
 * Scans all .astro files, extracts currently-used translatable strings,
 * and removes catalog entries that no longer appear in any source file.
 *
 * Usage:
 *   bun run src/i18n/prune.ts          # Report mode (dry-run)
 *   bun run src/i18n/prune.ts --apply  # Actually remove dead strings
 */

import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { extractFromAstro } from './extract';
import { loadAllCatalogs, saveCatalog } from './catalog';
import { readConfig } from './config';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apply = process.argv.includes('--apply');
  const config = readConfig();
  const { locales } = config;

  // 1. Extract all currently-used strings from .astro files
  const astroFiles = await glob('src/**/*.astro', { ignore: ['src/locales/**', 'node_modules/**'] });
  const activeStrings = new Set<string>();

  for (const file of astroFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      const extracted = await extractFromAstro(content, file);
      for (const item of extracted) {
        const msgid = item.msgid.replace(/\s+/g, ' ').trim();
        if (msgid) activeStrings.add(msgid);
      }
    } catch {
      // Skip unparseable files (same as integration)
    }
  }

  // 2. Load all catalogs
  const catalogs = await loadAllCatalogs('src/locales', locales);
  const enCatalog = catalogs['en'];
  if (!enCatalog) {
    console.error('[prune] en.json not found');
    process.exit(1);
  }

  // 3. Find dead strings
  const deadStrings: string[] = [];
  for (const key of Object.keys(enCatalog)) {
    if (!activeStrings.has(key)) {
      deadStrings.push(key);
    }
  }

  // 4. Report
  const total = Object.keys(enCatalog).length;
  const alive = total - deadStrings.length;

  console.log(`\n[prune] Catalog: ${total} entries`);
  console.log(`[prune] Active:  ${alive} strings found in .astro files`);
  console.log(`[prune] Dead:    ${deadStrings.length} strings not in any .astro file\n`);

  if (deadStrings.length === 0) {
    console.log('[prune] Nothing to prune.');
    return;
  }

  if (!apply) {
    console.log('Dead strings (would be removed):');
    console.log('─'.repeat(60));
    for (const str of deadStrings) {
      console.log(`  • ${str}`);
    }
    console.log('─'.repeat(60));
    console.log(`\nRun with --apply to remove ${deadStrings.length} dead strings from all catalogs.`);
    return;
  }

  // 5. Apply: remove dead strings from all locales
  for (const locale of locales) {
    const catalog = catalogs[locale];
    if (!catalog) continue;
    for (const key of deadStrings) {
      delete catalog[key];
    }
    await saveCatalog('src/locales', locale, catalog);
  }

  console.log(`[prune] Removed ${deadStrings.length} dead strings from ${locales.length} catalogs.`);
}

main().catch((err) => {
  console.error('[prune] Fatal:', err);
  process.exit(1);
});
