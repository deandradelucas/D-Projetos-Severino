/**
 * Persistência do cache de Investimentos no localStorage, por usuário.
 * Cold start instantâneo: hidrata a lista (com aportes/rendimento) e revalida
 * em background. Sem escopo — a lista é única por usuário.
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_investimentos_cache_v1:', maxItems: 60 })

export const readInvestimentosCache = cache.read
export const writeInvestimentosCache = cache.write
export const clearInvestimentosCache = cache.clear
