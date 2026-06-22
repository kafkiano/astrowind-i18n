/**
 * Translation provider interface, factory, and implementations.
 *
 * Supports: DeepL (via deepl-node) and Google Translate (v2 REST API).
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
// Google Translate provider (v2 REST API)
// ---------------------------------------------------------------------------

class GoogleProvider implements TranslationProvider {
  readonly name = 'google';
  readonly maxBatchSize = 128;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private buildUrl(): string {
    return `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
  }

  async translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const params = new URLSearchParams();
        for (const text of batch) params.append('q', text);
        params.set('target', targetLang);
        if (sourceLang) params.set('source', sourceLang);
        params.set('format', 'html');

        const res = await fetch(this.buildUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (!res.ok) throw new Error(`Google Translate API ${res.status}: ${await res.text()}`);

        const data = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
        const translations = data.data?.translations ?? [];
        for (let j = 0; j < batch.length && j < translations.length; j++) {
          if (translations[j].translatedText) {
            results[i + j] = translations[j].translatedText;
          }
        }
      } catch (err) {
        console.warn(`[provider:google] Batch ${i} failed:`, (err as Error).message);
      }
    }
    return results;
  }

  async translateText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.set('q', text);
      params.set('target', targetLang);
      if (sourceLang) params.set('source', sourceLang);
      params.set('format', 'html');

      const res = await fetch(this.buildUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!res.ok) throw new Error(`Google Translate API ${res.status}: ${await res.text()}`);

      const data = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
      return data.data?.translations?.[0]?.translatedText ?? '';
    } catch (err) {
      console.warn(`[provider:google] Translation failed:`, (err as Error).message);
      return '';
    }
  }

  async translatePlainText(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.set('q', text);
      params.set('target', targetLang);
      if (sourceLang) params.set('source', sourceLang);
      params.set('format', 'text');

      const res = await fetch(this.buildUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!res.ok) throw new Error(`Google Translate API ${res.status}: ${await res.text()}`);

      const data = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
      return data.data?.translations?.[0]?.translatedText ?? '';
    } catch (err) {
      console.warn(`[provider:google] Plain text translation failed:`, (err as Error).message);
      return '';
    }
  }

  async translatePlainTextBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]> {
    const results: string[] = new Array(texts.length).fill('');

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      try {
        const params = new URLSearchParams();
        for (const text of batch) params.append('q', text);
        params.set('target', targetLang);
        if (sourceLang) params.set('source', sourceLang);
        params.set('format', 'text');

        const res = await fetch(this.buildUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (!res.ok) throw new Error(`Google Translate API ${res.status}: ${await res.text()}`);

        const data = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
        const translations = data.data?.translations ?? [];
        for (let j = 0; j < batch.length && j < translations.length; j++) {
          if (translations[j].translatedText) {
            results[i + j] = translations[j].translatedText;
          }
        }
      } catch (err) {
        console.warn(`[provider:google] Plain text batch ${i} failed:`, (err as Error).message);
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

  if (config.provider === 'google') {
    if (!config.googleApiKey) throw new Error('[i18n] Google Translate API key not set.');
    return new GoogleProvider(config.googleApiKey);
  }

  if (!config.deeplApiKey) throw new Error('[i18n] DeepL API key not set.');
  return new DeepLProvider(config.deeplApiKey);
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
