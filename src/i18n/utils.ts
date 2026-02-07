// import type { GetLocaleOptions } from 'astro:i18n';
import { getRelativeLocaleUrl } from 'astro:i18n';
import { LOCALES } from '../utils/locales';

/**
 * Get the language from a URL object.
 * If Astro.i18n is available, returns current locale.
 * Fallback to 'en'.
 */
export function getLangFromUrl(url: URL): string {
  if (import.meta.env.SSR && (Astro as any).i18n) {
    return (Astro as any).currentLocale || 'en';
  }
  // For client-side or fallback, parse pathname
  const segments = url.pathname.split('/').filter(Boolean);
  const locales = LOCALES; // Should match astro.config.ts
  if (segments.length > 0 && locales.includes(segments[0])) {
    return segments[0];
  }
  return 'en';
}

/**
 * Load translations for a given locale.
 * Returns the dictionary for the given namespace (default 'common').
 */
export async function loadTranslations(locale: string, namespace = 'common'): Promise<Record<string, string>> {
  try {
    // Dynamic import of JSON translation files
    const module = await import(`../locales/${locale}/${namespace}.json`, {
      assert: { type: 'json' },
    });
    return module.default;
  } catch (error) {
    console.warn(`Failed to load translations for locale "${locale}", namespace "${namespace}"`, error);
    return {};
  }
}

/**
 * Create a translation function for the current locale.
 * Must be called inside Astro components (SSR) where Astro.currentLocale is available.
 */
export function useTranslations(locale?: string, namespace = 'common'): (key: string) => string {
  const currentLocale = locale || (import.meta.env.SSR ? (Astro as any).currentLocale : 'en');
  let dict: Record<string, string> = {};

  // In SSR, we can load synchronously via import? but we'll keep async for simplicity.
  // For now, we'll return a function that will look up from a preloaded dictionary.
  // We'll implement a more robust solution with caching.
  return (key: string) => {
    // This is a placeholder; in a real implementation we'd load the dictionary.
    // For simplicity, we'll return the key.
    return key;
  };
}

/**
 * Returns a function that translates a path to the target locale.
 * Uses Astro's built-in getRelativeLocaleUrl if available.
 */
export function useTranslatedPath(targetLocale?: string): (path: string, locale?: string) => string {
  return (path: string, locale?: string) => {
    const target = locale || targetLocale;
    if (!target) {
      return path; // no translation possible
    }
    try {
      // Use Astro's i18n utilities if available
      if (import.meta.env.SSR && (Astro as any).i18n) {
        return getRelativeLocaleUrl(target as any, path);
      }
    } catch (e) {
      console.warn('Failed to generate translated path', e);
    }
    // Fallback: prepend locale if not default
    const defaultLocale = 'en';
    const shouldPrefix = target !== defaultLocale;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return shouldPrefix ? `/${target}/${cleanPath}` : `/${cleanPath}`;
  };
}

/**
 * Get the current locale from Astro context (SSR only).
 */
export function getCurrentLocale(): string {
  if (import.meta.env.SSR && (Astro as any).currentLocale) {
    return (Astro as any).currentLocale;
  }
  return 'en';
}
