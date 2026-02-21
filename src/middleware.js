import * as main from './locales/main.loader.js';
import * as navigation from './locales/navigation.loader.server.js';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { locales } from './locales/data.js';

let ready = false;
const readyPromise = Promise.all([
  loadLocales(main.key, main.loadIDs, main.loadCatalog, locales),
  loadLocales(navigation.key, navigation.loadIDs, navigation.loadCatalog, locales),
]).then(() => {
  ready = true;
});

export async function onRequest(context, next) {
  if (!ready) {
    await readyPromise;
  }
  const locale = context.params.locale ?? 'en';
  return runWithLocale(locale, next);
}
