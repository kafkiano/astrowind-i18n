import * as main from './locales/main.loader.js';
import * as navigation from './locales/navigation.loader.server.js';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { locales } from './locales/data.js';

// load at server startup
// Both adapters share the same catalog ('main'), but each needs its own registration
loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
loadLocales(navigation.key, navigation.loadIDs, navigation.loadCatalog, locales);

export function onRequest(context, next) {
    const locale = context.params.locale ?? 'en';
    return runWithLocale(locale, next);
}
