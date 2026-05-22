/**
 * Translation provider interface, factory, and implementations.
 *
 * Supports: Gemini (via @google/genai) and DeepL (via deepl-node).
 * Configured via src/config.yaml: i18n.translation.provider
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { GoogleGenAI } from '@google/genai';
import * as deepl from 'deepl-node';
import type { SourceLanguageCode, TargetLanguageCode } from 'deepl-node';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TranslationProvider {
  readonly name: string;
  readonly maxBatchSize: number;
  /** Translate multiple short strings (UI labels, one per line). */
  translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]>;
  /** Translate a single multi-line text (markdown body). Returns full translation. */
  translateText(text: string, targetLang: string, sourceLang?: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Gemini provider
// ---------------------------------------------------------------------------

class GeminiProvider implements TranslationProvider {
  readonly name = 'gemini';
  readonly maxBatchSize = 30;
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async translateBatch(texts: string[], targetLang: string, sourceLang: string = 'en'): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Translate these ${getLanguageName(sourceLang)} strings to ${getLanguageName(targetLang)} (${targetLang}).\nReturn ONLY the translations, one per line, in the same order.\nDo not add quotes, numbering, or explanations.\n\n${batch.join('\n')}`,
                },
              ],
            },
          ],
        });

        const raw = response.text?.trim() ?? '';
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

  async translateText(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Translate the following ${getLanguageName(sourceLang)} text to ${getLanguageName(targetLang)} (${targetLang}).\nPreserve all formatting, markdown syntax, code blocks, and structure exactly.\nReturn ONLY the translation, nothing else.\n\n${text}`,
              },
            ],
          },
        ],
      });

      return response.text?.trim() ?? '';
    } catch (err) {
      console.warn(`[provider:gemini] Text translation failed:`, (err as Error).message);
      return '';
    }
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
    try {
      const [result] = await this.translateBatch([text], targetLang, sourceLang);
      return result;
    } catch (err) {
      console.warn(`[provider:deepl] Text translation failed:`, (err as Error).message);
      return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Config & factory
// ---------------------------------------------------------------------------

interface ProviderConfig {
  provider: 'gemini' | 'deepl';
  geminiApiKey?: string;
  deeplApiKey?: string;
  model?: string;
}

function readYamlConfig(): ProviderConfig {
  const configPath = path.resolve('src/config.yaml');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(raw) as {
    i18n?: {
      translation?: { provider?: string; geminiApiKey?: string; deeplApiKey?: string; model?: string };
      ai?: { provider?: string; geminiApiKey?: string; deeplApiKey?: string; model?: string };
    };
  };
  const t = config?.i18n?.translation || config?.i18n?.ai || {};
  return {
    provider: (process.env.I18N_PROVIDER as 'gemini' | 'deepl') || (t.provider as 'gemini' | 'deepl') || 'gemini',
    geminiApiKey: (process.env.GEMINI_API_KEY || t.geminiApiKey || undefined) as string | undefined,
    deeplApiKey: (process.env.DEEPL_API_KEY || t.deeplApiKey || undefined) as string | undefined,
    model: (process.env.I18N_MODEL || t.model || undefined) as string | undefined,
  };
}

function createProvider(): TranslationProvider {
  const config = readYamlConfig();

  if (config.provider === 'deepl') {
    const key = config.deeplApiKey;
    if (!key) throw new Error('[i18n] DeepL API key not set.');
    return new DeepLProvider(key);
  }

  const key = config.geminiApiKey;
  if (!key) throw new Error('[i18n] Gemini API key not set.');
  return new GeminiProvider(key, config.model);
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
