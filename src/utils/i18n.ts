import { getRelativeLocaleUrl } from 'astro:i18n';
import { LOCALES, DEFAULT_LOCALE } from './locales';

interface AstroGlobal {
  currentLocale?: string;
  i18n?: {
    currentLocale?: string;
  };
}

declare const Astro: AstroGlobal;

/**
 * Get the language from a URL object.
 * If Astro.i18n is available, returns current locale.
 * Fallback to DEFAULT_LOCALE.
 * @throws {Error} If i18n configuration is missing and no locale can be determined
 */
export function getLangFromUrl(url: URL): string {
  if (import.meta.env.SSR && Astro.i18n) {
    return Astro.i18n?.currentLocale || DEFAULT_LOCALE;
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
      if (import.meta.env.SSR && Astro.i18n) {
        return getRelativeLocaleUrl(target, path);
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
 * Get the current locale from Astro context with robust fallback chain.
 * 1. Try Astro.currentLocale (Astro 5+)
 * 2. Try Astro.i18n (legacy)
 * 3. Parse from URL (client-side fallback)
 * 4. Default to DEFAULT_LOCALE
 * @throws {Error} If called outside an i18n route context and no locale can be determined
 */
export function getCurrentLocale(): string {
  // 1. Try Astro.currentLocale (Astro 5+)
  if (typeof Astro !== 'undefined' && Astro.currentLocale) {
    return Astro.currentLocale;
  }
  // 2. Try Astro.i18n (legacy)
  if (typeof Astro !== 'undefined' && Astro.i18n?.currentLocale) {
    return Astro.i18n.currentLocale;
  }
  // 3. Parse from URL (client-side fallback)
  if (typeof window !== 'undefined') {
    const seg = window.location.pathname.split('/').filter(Boolean);
    if (seg.length > 0 && LOCALES.includes(seg[0])) return seg[0];
  }
  // 4. Default
  return DEFAULT_LOCALE;
}

/**
 * Remove locale prefix from a pathname.
 * @param pathname - The pathname to strip locale from
 * @returns Pathname without locale prefix
 */
export function getPathWithoutLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      const withoutLocale = pathname.replace(`/${locale}`, '');
      return withoutLocale === '' ? '' : withoutLocale;
    }
  }
  return pathname;
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
