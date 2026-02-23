import { DEFAULT_LOCALE } from './utils/locales';
import { getHeaderData as getAutoHeaderData, getFooterData as getAutoFooterData } from './utils/auto-navigation';

/**
 * Get header navigation data
 * @param locale - The locale code (defaults to DEFAULT_LOCALE)
 */
export const getHeaderData = (locale: string = DEFAULT_LOCALE) => getAutoHeaderData(locale);

/**
 * Get footer navigation data
 * @param locale - The locale code (defaults to DEFAULT_LOCALE)
 */
export const getFooterData = (locale: string = DEFAULT_LOCALE) => getAutoFooterData(locale);

// Keep backward compatibility for now (optional)
export const headerData = getHeaderData(DEFAULT_LOCALE);
export const footerData = getFooterData(DEFAULT_LOCALE);
