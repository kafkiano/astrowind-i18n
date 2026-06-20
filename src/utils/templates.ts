/**
 * Template entry loader with locale fallback.
 *
 * Looks up a template entry for the current locale, falls back to the
 * default locale (en) if the translated version doesn't exist yet.
 * This happens when no translation provider key is configured.
 */

import { getEntry, type CollectionEntry } from 'astro:content';

/**
 * Get a template entry with automatic locale fallback.
 *
 * @param slug - Template slug without locale prefix (e.g. 'home', 'about', 'services')
 * @param locale - Current locale from Astro.currentLocale
 * @returns The template entry (locale-specific or English fallback)
 * @throws If the template doesn't exist in any locale
 */
export async function getTemplateEntry(
  slug: string,
  locale: string
): Promise<CollectionEntry<'templates'>> {
  let entry = await getEntry('templates', `${locale}/${slug}`);
  if (!entry) {
    entry = await getEntry('templates', `en/${slug}`);
  }
  if (!entry) {
    throw new Error(`Template "${slug}" not found for locale: ${locale} (or fallback en)`);
  }
  return entry;
}
