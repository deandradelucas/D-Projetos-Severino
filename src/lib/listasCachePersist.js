/**
 * Persistência do cache de Listas (compras/tarefas) no localStorage, por usuário.
 *
 * No cold start do PWA, pinta listas + itens instantaneamente com o último
 * estado conhecido enquanto revalida em background. Guarda apenas o snapshot do
 * escopo PADRÃO (família/default, sem `?pessoal=1`), para não exibir listas de
 * um escopo no outro. Dados do próprio usuário, no próprio dispositivo.
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_listas_cache_v1:', maxItems: 60 })

export const readListasCache = cache.read
export const writeListasCache = cache.write
export const clearListasCache = cache.clear
