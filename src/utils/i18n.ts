import { getRelativeLocaleUrl } from 'astro:i18n';
import { LOCALES, DEFAULT_LOCALE } from './locales';

/**
 * Get the language from a URL object.
 * If Astro.i18n is available, returns current locale.
 * Fallback to DEFAULT_LOCALE.
 */
export function getLangFromUrl(url: URL): string {
  if (import.meta.env.SSR && (Astro as any).i18n) {
    return (Astro as any).currentLocale || DEFAULT_LOCALE;
  }
  // For client-side or fallback, parse pathname
  const segments = url.pathname.split('/').filter(Boolean);
  const locales = LOCALES; // Should match astro.config.ts
  if (segments.length > 0 && locales.includes(segments[0])) {
    return segments[0];
  }
  return DEFAULT_LOCALE;
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
    const defaultLocale = DEFAULT_LOCALE;
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
  return DEFAULT_LOCALE;
}

/**
 * Generate static paths for all locales.
 * Used in page components for Astro's getStaticPaths.
 */
export const getStaticPathsForLocale = () =>
  LOCALES.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));