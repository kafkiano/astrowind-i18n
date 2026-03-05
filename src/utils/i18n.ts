import { I18N } from 'astrowind:config';

/**
 * Remove locale prefix from a pathname.
 * @param pathname - The pathname to strip locale from
 * @returns Pathname without locale prefix
 */
export function getPathWithoutLocale(pathname: string): string {
  for (const locale of I18N.locales) {
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
  I18N.locales.map((locale: string) => ({
    params: { locale },
    props: { locale },
  }));
