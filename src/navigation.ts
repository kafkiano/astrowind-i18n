import { I18N } from 'astrowind:config';
import { getHeaderData as getAutoHeaderData, getFooterData as getAutoFooterData } from './utils/auto-navigation';

/**
 * Get header navigation data
 * @param locale - The locale code (defaults to I18N.defaultLocale)
 */
export const getHeaderData = (locale: string = I18N.defaultLocale) => getAutoHeaderData(locale);

/**
 * Get footer navigation data
 * @param locale - The locale code (defaults to I18N.defaultLocale)
 */
export const getFooterData = (locale: string = I18N.defaultLocale) => getAutoFooterData(locale);
