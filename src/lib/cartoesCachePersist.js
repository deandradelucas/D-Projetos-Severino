/**
 * Persistência do cache de Cartões no localStorage, por usuário.
 *
 * Cold start instantâneo: hidrata a lista de cartões (com fatura_atual embutida)
 * do último estado conhecido e revalida em background. Guarda só o snapshot do
 * escopo PADRÃO (família/default, sem `?pessoal=1`).
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_cartoes_cache_v1:', maxItems: 40 })

export const readCartoesCache = cache.read
export const writeCartoesCache = cache.write
export const clearCartoesCache = cache.clear
