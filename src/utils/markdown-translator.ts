/**
 * AI translation for markdown content using Gemini.
 * Sends JSON-format messages, receives JSON translations back.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { GoogleGenAI } from '@google/genai';

interface TranslateOptions {
  sourceLocale: string;
  targetLocale: string;
  messages: Array<{ msgid: string; msgstr: string }>;
  batchSize?: number;
  parallel?: number;
}

/**
 * Translate a single batch of messages using Gemini.
 * Sends messages as JSON array, expects JSON array back.
 */
async function translateBatch(
  apiKey: string,
  messages: Array<{ msgid: string; msgstr: string }>,
  sourceLang: string,
  targetLang: string,
  maxRetries: number = 3
): Promise<Map<string, string>> {
  const ai = new GoogleGenAI({ apiKey });

  const inputJson = JSON.stringify(messages.map((m) => ({ msgid: m.msgid })));

  const instruction = [
    `Translate the "msgid" values in this JSON array from ${sourceLang} to ${targetLang}.`,
    `Return a JSON object mapping each msgid to its translation: {"msgid": "translation"}.`,
    `Preserve all placeholders like {0}, {1}, <0>, </0>, and markdown formatting.`,
    `Return ONLY the JSON object, no explanations.`,
  ].join(' ');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: instruction + '\n\n' + inputJson }] }],
      });

      const text = response.text?.trim() || '';
      if (!text) {
        if (attempt < maxRetries) {
          console.warn(`[markdown-translator] Empty response, retrying (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        return new Map();
      }

      return parseTranslationResponse(text);
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
 * Parse Gemini's JSON response into a Map<msgid, translation>.
 */
function parseTranslationResponse(text: string): Map<string, string> {
  const result = new Map<string, string>();

  // Extract JSON object from response (may have markdown fences)
  let json = text;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) json = fenceMatch[1];
  json = json.trim();

  try {
    const obj = JSON.parse(json);
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.trim()) {
          result.set(key, value);
        }
      }
    }
  } catch {
    // Fallback: try line-by-line parsing
    for (const line of json.split('\n')) {
      const match = line.match(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      if (match) {
        result.set(JSON.parse(`"${match[1]}"`), JSON.parse(`"${match[2]}"`));
      }
    }
  }

  return result;
}

/**
 * Translate messages using Gemini AI.
 */
export async function translateMessages(options: TranslateOptions): Promise<Map<string, string>> {
  const { sourceLocale, targetLocale, messages, batchSize = 30, parallel = 3 } = options;

  if (messages.length === 0) return new Map();

  // Read Gemini API key from environment or config
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (() => {
      try {
        const configPath = path.resolve('src/config.yaml');
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const projectConfig = yaml.load(configContent) as { i18n?: { ai?: { geminiApiKey?: string | null } } };
        return projectConfig?.i18n?.ai?.geminiApiKey || null;
      } catch {
        return null;
      }
    })();

  if (!geminiKey) {
    console.warn('[markdown-translator] No Gemini API key. Skipping translation.');
    return new Map();
  }

  const sourceLang = getLanguageName(sourceLocale);
  const targetLang = getLanguageName(targetLocale);

  // Split into batches
  const batches: Array<Array<{ msgid: string; msgstr: string }>> = [];
  for (let i = 0; i < messages.length; i += batchSize) {
    batches.push(messages.slice(i, i + batchSize));
  }

  console.log(
    `[markdown-translator] Translating ${messages.length} messages to ${targetLocale} in ${batches.length} batches...`
  );

  const result = new Map<string, string>();

  for (let i = 0; i < batches.length; i += parallel) {
    const batchGroup = batches.slice(i, i + parallel);
    const batchResults = await Promise.all(
      batchGroup.map(async (batch, batchIndex) => {
        try {
          const batchResult = await translateBatch(geminiKey, batch, sourceLang, targetLang);
          console.log(
            `[markdown-translator] Batch ${i + batchIndex + 1}/${batches.length}: ${batchResult.size} translations`
          );
          return batchResult;
        } catch (error) {
          console.error(`[markdown-translator] Batch ${i + batchIndex + 1} failed:`, error);
          return new Map<string, string>();
        }
      })
    );

    for (const batchResult of batchResults) {
      for (const [msgid, msgstr] of batchResult) {
        result.set(msgid, msgstr);
      }
    }
  }

  console.log(`[markdown-translator] Total: ${result.size} translations for ${targetLocale}`);
  return result;
}

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
  };
  return names[locale] || locale;
}
