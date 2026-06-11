/**
 * Persistência do cache da Agenda no localStorage, por usuário.
 *
 * A Agenda carrega por janela (range de datas). O mount usa SEMPRE o mês atual,
 * então guardamos só o snapshot desse mês — junto do `monthKey` para validar na
 * hidratação (se o mês virou, ignora o cache velho e revalida).
 *
 * Valor guardado: { monthKey: 'YYYY-MM', eventos: [...] }.
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_agenda_cache_v1:' })

/** Lê o snapshot só se for do mês pedido; senão null (cache de outro mês = inútil). */
export function readAgendaCache(usuarioId, monthKey) {
  const v = cache.read(usuarioId)
  if (!v || typeof v !== 'object' || v.monthKey !== monthKey) return null
  return Array.isArray(v.eventos) ? v.eventos : null
}

/** Grava o snapshot do mês (eventos cortados em 400 para a cota). */
export function writeAgendaCache(usuarioId, monthKey, eventos) {
  const lista = Array.isArray(eventos) ? eventos.slice(0, 400) : []
  cache.write(usuarioId, { monthKey, eventos: lista })
}

export const clearAgendaCache = cache.clear
