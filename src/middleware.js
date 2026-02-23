import * as main from './locales/main.loader.js';
import { runWithLocale, loadLocales } from 'wuchale/load-utils/server';
import { locales } from './locales/data.js';
import { I18N } from 'astrowind:config';

let ready = false;
const readyPromise = Promise.all([
  loadLocales(main.key, main.loadIDs, main.loadCatalog, locales),
]).then(() => {
  ready = true;
});

export async function onRequest(context, next) {
  if (!ready) {
    await readyPromise;
  }
  const locale = context.params.locale ?? I18N.defaultLocale;
  return runWithLocale(locale, next);
}
