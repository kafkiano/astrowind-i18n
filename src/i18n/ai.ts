/**
 * AI translation for i18n JSON catalogs using Gemini.
 *
 * During extraction, new strings without translations are sent to Gemini.
 * Mirrors the existing markdown-translator.ts approach.
 */

import { GoogleGenAI } from '@google/genai';
import { getUntranslated, loadCatalog, saveCatalog, type Catalog } from './catalog';

/**
 * Translate untranslated strings in a locale catalog using Gemini.
 * Returns the number of strings translated.
 */
export async function translateWithGemini(
  localesDir: string,
  locale: string,
  apiKey: string
): Promise<number> {
  const catalog = loadCatalog(localesDir, locale);
  const untranslated = getUntranslated(catalog);

  if (untranslated.length === 0) return 0;

  const ai = new GoogleGenAI({ apiKey });

  // Translate in batches of 10 to avoid token limits
  const BATCH_SIZE = 10;
  let translated = 0;

  for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
    const batch = untranslated.slice(i, i + BATCH_SIZE);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Translate these English UI strings to ${getLanguageName(locale)} (${locale}).
For each string, return ONLY the translation, one per line, in the same order.
Do not add explanations, numbering, or quotes.

${batch.join('\n')}`,
              },
            ],
          },
        ],
      });

      const text = response.text?.trim() ?? '';
      const translations = text.split('\n').map((t) => t.trim());

      for (let j = 0; j < batch.length && j < translations.length; j++) {
        const translation = translations[j];
        if (translation && translation !== batch[j]) {
          catalog[batch[j]] = translation;
          translated++;
        }
      }
    } catch (err) {
      console.warn(`[i18n-ai] Gemini translation failed for ${locale} batch ${i}:`, (err as Error).message);
    }

    // Rate limiting: wait 500ms between batches
    if (i + BATCH_SIZE < untranslated.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (translated > 0) {
    saveCatalog(localesDir, locale, catalog);
  }

  return translated;
}

function getLanguageName(locale: string): string {
  const names: Record<string, string> = {
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    pl: 'Polish',
    ru: 'Russian',
    ja: 'Japanese',
    zh: 'Chinese',
    ko: 'Korean',
  };
  return names[locale] || locale;
}
