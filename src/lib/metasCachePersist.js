/**
 * Persistência do cache de Metas no localStorage, por usuário.
 * Cold start instantâneo: hidrata a lista de metas e revalida em background.
 * Guarda só o snapshot do escopo PADRÃO (família/default, sem `?pessoal=1`).
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_metas_cache_v1:', maxItems: 60 })

export const readMetasCache = cache.read
export const writeMetasCache = cache.write
export const clearMetasCache = cache.clear
