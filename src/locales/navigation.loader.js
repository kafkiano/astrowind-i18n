import { registerLoaders } from 'wuchale/load-utils'
import { loadCatalog, loadIDs } from './.wuchale/navigation.proxy.js'

const key = 'navigation'

// two exports. can be used anywhere
export const getRuntime = registerLoaders(key, loadCatalog, loadIDs)
export const getRuntimeRx = getRuntime
