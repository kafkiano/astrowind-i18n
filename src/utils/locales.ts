import { I18N } from 'astrowind:config';

export const LOCALES = I18N.locales;
export const DEFAULT_LOCALE = I18N.defaultLocale;
export const LANGUAGE = I18N.language;
export const TEXT_DIRECTION = I18N.textDirection;

// Helper for Astro's i18n config format
export const getAstroI18nConfig = () => ({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  routing: {
    prefixDefaultLocale: true,
  },
});
