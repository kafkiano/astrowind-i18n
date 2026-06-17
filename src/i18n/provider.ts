/**
 * Translation provider interface, factory, and implementations.
 *
 * Supports: Gemini (via REST API) and DeepL (via deepl-node).
 * Configured via src/i18n/config.ts → src/config.yaml
 */
import { readConfig } from './config';
import * as deepl from 'deepl-node';
import type { SourceLanguageCode, TargetLanguageCode } from 'deepl-node';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TranslationProvider {
  readonly name: string;
  readonly maxBatchSize: number;
  /** Translate multiple short strings (UI labels, one per line). HTML tag handling enabled. */
  translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]>;
  /** Translate a single multi-line text (markdown body). HTML tag handling enabled. */
  translateText(text: string, targetLang: string, sourceLang?: string): Promise<string>;
  /** Translate plain text without HTML tag handling. No entity encoding. For markdown pipeline. */
  translatePlainText(text: string, targetLang: string, sourceLang?: string): Promise<string>;
  /** Translate multiple plain text strings without HTML tag handling. For markdown frontmatter. */
  translatePlainTextBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

interface GeminiPart {
  text: string;
}

interface GeminiCandidate {
  content: { parts: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string };
}

class GeminiProvider implements TranslationProvider {
  readonly name = 'gemini';
  readonly maxBatchSize = 30;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async generateContent(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }

    const data: GeminiResponse = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  async translateBatch(texts: string[], targetLang: string, sourceLang: string): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const prompt = `Translate these ${getLanguageName(sourceLang)} strings to ${getLanguageName(targetLang)} (${targetLang}).\nReturn ONLY the translations, one per line, in the same order.\nDo not add quotes, numbering, or explanations.\n\n${batch.join('\n')}`;
        const raw = (await this.generateContent(prompt)).trim();
        const lines = raw.split('\n').map((l) => l.trim());
        for (let j = 0; j < batch.length && j < lines.length; j++) {
          if (lines[j]) results[i + j] = lines[j];
        }
      } catch (err) {
        console.warn(`[provider:gemini] Batch ${i} failed:`, (err as Error).message);
      }
      if (i + this.maxBatchSize < texts.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return results;
  }

  async translateText(text: string, targetLang: string, sourceLang: string): Promise<string> {
    try {
      const prompt = `Translate the following ${getLanguageName(sourceLang)} text to ${getLanguageName(targetLang)} (${targetLang}).\nPreserve all formatting, markdown syntax, code blocks, and structure exactly.\nReturn ONLY the translation, nothing else.\n\n${text}`;
      return (await this.generateContent(prompt)).trim();
    } catch (err) {
      console.warn(`[provider:gemini] Text translation failed:`, (err as Error).message);
      return '';
    }
  }

  async translatePlainText(text: string, targetLang: string, sourceLang: string): Promise<string> {
    // Gemini doesn't HTML-encode, so plain text is the same as regular translation
    return this.translateText(text, targetLang, sourceLang);
  }

  async translatePlainTextBatch(texts: string[], targetLang: string, sourceLang: string): Promise<string[]> {
    // Gemini doesn't HTML-encode, so plain text batch is the same as regular batch
    return this.translateBatch(texts, targetLang, sourceLang);
  }
}

// ---------------------------------------------------------------------------
// DeepL provider
// ---------------------------------------------------------------------------

class DeepLProvider implements TranslationProvider {
  readonly name = 'deepl';
  readonly maxBatchSize = 50;
  private client: deepl.DeepLClient;

  constructor(apiKey: string) {
    this.client = new deepl.DeepLClient(apiKey);
  }

  async translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const response = await this.client.translateText(
          batch,
          sourceLang ? (sourceLang.toUpperCase() as SourceLanguageCode) : null,
          targetLang.toUpperCase() as TargetLanguageCode,
          { tagHandling: 'html', formality: 'default', preserveFormatting: true }
        );
        for (let j = 0; j < response.length; j++) {
          if (response[j].text) {
            results[i + j] = response[j].text;
          }
        }
      } catch (err) {
        console.warn(`[provider:deepl] Batch ${i} failed:`, (err as Error).message);
      }
    }
    return results;
  }

  async translateText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    const [result] = await this.translateBatch([text], targetLang, sourceLang);
    return result || '';
  }

  async translatePlainText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    try {
      const response = await this.client.translateText(
        text,
        sourceLang ? (sourceLang.toUpperCase() as SourceLanguageCode) : null,
        targetLang.toUpperCase() as TargetLanguageCode,
        { formality: 'default', preserveFormatting: true }
      );
      return typeof response === 'object' && 'text' in response ? response.text : '';
    } catch (err) {
      console.warn(`[provider:deepl] Plain text translation failed:`, (err as Error).message);
      return '';
    }
  }

  async translatePlainTextBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const response = await this.client.translateText(
          batch,
          sourceLang ? (sourceLang.toUpperCase() as SourceLanguageCode) : null,
          targetLang.toUpperCase() as TargetLanguageCode,
          { formality: 'default', preserveFormatting: true }
        );
        for (let j = 0; j < response.length; j++) {
          if (response[j].text) {
            results[i + j] = response[j].text;
          }
        }
      } catch (err) {
        console.warn(`[provider:deepl] Plain text batch ${i} failed:`, (err as Error).message);
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createProvider(): TranslationProvider {
  const config = readConfig();

  if (config.provider === 'deepl') {
    if (!config.deeplApiKey) throw new Error('[i18n] DeepL API key not set.');
    return new DeepLProvider(config.deeplApiKey);
  }

  if (!config.geminiApiKey) throw new Error('[i18n] Gemini API key not set.');
  return new GeminiProvider(config.geminiApiKey, config.model);
}

let _provider: TranslationProvider | null = null;

export async function getProvider(): Promise<TranslationProvider | null> {
  if (_provider) return _provider;
  try {
    _provider = createProvider();
    return _provider;
  } catch (err) {
    console.warn('[i18n] Translation provider unavailable:', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLanguageName(locale: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
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
