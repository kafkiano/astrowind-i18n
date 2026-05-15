import { getConfig } from 'wuchale';
import PO from 'pofile';

interface TranslateOptions {
  sourceLocale: string;
  targetLocale: string;
  messages: Array<{ msgid: string; msgstr: string }>;
  batchSize?: number;
  parallel?: number;
}

/**
 * Translate a single batch of messages with retry logic.
 */
async function translateBatch(
  ai: { translate: (messages: string, instruction: string) => Promise<string> },
  messages: Array<{ msgid: string; msgstr: string }>,
  sourceLang: string,
  targetLang: string,
  maxRetries: number = 3
): Promise<Map<string, string>> {
  const poContent = buildMiniPO(messages);

  const instruction = [
    `You will be given the contents of a gettext .po file for a web app.`,
    `Translate each of the items from ${sourceLang} to ${targetLang}.`,
    `Provide the same content with the only difference being that the`,
    `empty msgstr quotes should be filled with the appropriate translations,`,
    `preserving all placeholders and markdown formatting.`,
    `Do not add any explanations or extra text, only the translated .po content.`,
  ].join(' ');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.translate(poContent, instruction);

      if (!response || response.trim().length === 0) {
        if (attempt < maxRetries) {
          console.warn(`[markdown-translator] Empty response, retrying (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return new Map();
      }

      return parseTranslatedPO(response);
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`[markdown-translator] Batch failed, retrying (${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }

  return new Map();
}

/**
 * Translate messages using wuchale's AI translation.
 * Batches messages to avoid API limits.
 *
 * @returns Map of msgid → translated msgstr
 */
export async function translateMessages(options: TranslateOptions): Promise<Map<string, string>> {
  const { sourceLocale, targetLocale, messages, batchSize = 50, parallel = 2 } = options;

  if (messages.length === 0) {
    return new Map();
  }

  // Get wuchale config to access AI
  const config = await getConfig();
  const ai = config.ai;

  if (!ai || !ai.translate) {
    console.warn('[markdown-translator] No AI configured in wuchale config. Skipping translation.');
    return new Map();
  }

  const sourceLang = getLanguageName(sourceLocale);
  const targetLang = getLanguageName(targetLocale);

  // Split messages into batches
  const batches: Array<Array<{ msgid: string; msgstr: string }>> = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }

  console.log(
    `[markdown-translator] Translating ${messages.length} messages to ${targetLocale} in ${batches.length} batches...`
  );

  const result = new Map<string, string>();

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += parallel) {
    const batchGroup = batches.slice(i, i + parallel);
    const batchResults = await Promise.all(
      batchGroup.map(async (batch, batchIndex) => {
        try {
          const batchResult = await translateBatch(ai, batch, sourceLang, targetLang);
          console.log(
            `[markdown-translator] Batch ${i + batchIndex + 1}/${batches.length}: got ${batchResult.size} translations`
          );
          return batchResult;
        } catch (error) {
          console.error(`[markdown-translator] Batch ${i + batchIndex + 1}/${batches.length} failed:`, error);
          return new Map<string, string>();
        }
      })
    );

    // Merge batch results
    for (const batchResult of batchResults) {
      for (const [msgid, msgstr] of batchResult) {
        result.set(msgid, msgstr);
      }
    }
  }

  console.log(`[markdown-translator] Total: got ${result.size} translations for ${targetLocale}`);
  return result;
}

/**
 * Build a minimal PO string from messages for translation.
 */
function buildMiniPO(messages: Array<{ msgid: string; msgstr: string }>): string {
  const lines: string[] = [];

  // PO header
  lines.push('msgid ""');
  lines.push('msgstr ""');
  lines.push('"Content-Type: text/plain; charset=utf-8\\n"');
  lines.push('');

  for (const msg of messages) {
    const escapedMsgid = escapePO(msg.msgid);
    if (escapedMsgid.includes('\n')) {
      // Multi-line msgid
      const msgidLines = escapedMsgid.split('\n');
      lines.push('msgid ""');
      for (const line of msgidLines) {
        lines.push(`"${line}\\n"`);
      }
    } else {
      lines.push(`msgid "${escapedMsgid}"`);
    }
    lines.push('msgstr ""');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parse a translated PO response and extract msgid → msgstr mappings.
 */
function parseTranslatedPO(poContent: string): Map<string, string> {
  const po = PO.parse(poContent);
  const result = new Map<string, string>();

  for (const item of po.items) {
    if (item.msgid && item.msgstr[0]) {
      result.set(item.msgid, item.msgstr[0]);
    }
  }

  return result;
}

/**
 * Escape special characters for PO format.
 */
function escapePO(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

/**
 * Get a human-readable language name from a locale code.
 */
function getLanguageName(locale: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    ar: 'Arabic',
    hi: 'Hindi',
    ru: 'Russian',
    nl: 'Dutch',
    pl: 'Polish',
    sv: 'Swedish',
    da: 'Danish',
    fi: 'Finnish',
    nb: 'Norwegian',
    nn: 'Norwegian Nynorsk',
  };
  return names[locale] || locale;
}
