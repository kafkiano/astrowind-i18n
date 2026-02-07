import { loadLocales } from 'wuchale/load-utils/server';
import { loadCatalog, loadIDs } from './.wuchale/navigation.proxy.sync.js';
import { locales } from './data.js';

const key = 'navigation';

export const getRuntime = await loadLocales(key, loadIDs, loadCatalog, locales);
export const getRuntimeRx = getRuntime;
export { loadCatalog, loadIDs, key };
