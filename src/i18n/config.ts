/**
 * Single source of truth for i18n configuration.
 *
 * Reads src/config.yaml once, merges with env var overrides.
 * All other i18n modules import from here — no duplicate YAML parsing.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  /** Per-locale text direction. Only specify RTL locales (e.g. { ar: 'rtl' }). Default is 'ltr'. */
  localeDirections?: Record<string, 'ltr' | 'rtl'>;
  /** Translation provider: 'gemini' or 'deepl' */
  provider: 'gemini' | 'deepl';
  geminiApiKey?: string;
  deeplApiKey?: string;
  /** Gemini model (e.g. 'gemini-2.5-flash', 'gemma-4-26b-a4b-it') */
  model?: string;
}

let _config: I18nConfig | null = null;

export function readConfig(): I18nConfig {
  if (_config) return _config;

  const configPath = path.resolve('src/config.yaml');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(raw) as {
    i18n?: {
      locales?: string[];
      defaultLocale?: string;
      localeDirections?: Record<string, 'ltr' | 'rtl'>;
      translation?: { provider?: string; geminiApiKey?: string; deeplApiKey?: string; model?: string };
      ai?: { provider?: string; geminiApiKey?: string; deeplApiKey?: string; model?: string };
    };
  };

  const i18n = config?.i18n || {};
  // Merge both 'translation' and 'ai' config paths (backward compat)
  const t = { ...(i18n.translation || {}), ...(i18n.ai || {}) };

  _config = {
    locales: i18n.locales || ['en'],
    defaultLocale: i18n.defaultLocale || 'en',
    localeDirections: (i18n.localeDirections as Record<string, 'ltr' | 'rtl'>) || {},
    provider: (process.env.I18N_PROVIDER as 'gemini' | 'deepl') || (t.provider as 'gemini' | 'deepl') || 'gemini',
    geminiApiKey: (process.env.GEMINI_API_KEY || t.geminiApiKey || undefined) as string | undefined,
    deeplApiKey: (process.env.DEEPL_API_KEY || t.deeplApiKey || undefined) as string | undefined,
    model: (process.env.I18N_MODEL || t.model || undefined) as string | undefined,
  };

  return _config;
}
