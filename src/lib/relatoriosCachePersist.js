/**
 * Persistência do cache de Relatórios no localStorage, por usuário.
 *
 * As transações do Relatório são filtradas por PERÍODO (e categoria). Guardamos
 * o snapshot junto da assinatura do filtro (`sig`) e só hidratamos quando o
 * filtro atual bate — cache de outro período é inútil para a tela aberta.
 *
 * Valor guardado: { sig: 'inicio|fim|categoria', transacoes: [...] }.
 */
import { createPersistedCache } from './persistedCache'

const cache = createPersistedCache({ prefix: 'horizonte_relatorios_cache_v1:' })

/** Assinatura do filtro de período usada como chave de validade do snapshot. */
export function relFiltersSig(f) {
  return `${f?.dataInicio || ''}|${f?.dataFim || ''}|${f?.categoria_id || ''}`
}

/** Lê o snapshot só se a assinatura do filtro bater; senão null. */
export function readRelatoriosCache(usuarioId, sig) {
  const v = cache.read(usuarioId)
  if (!v || typeof v !== 'object' || v.sig !== sig) return null
  return Array.isArray(v.transacoes) ? v.transacoes : null
}

/** Grava o snapshot do período (transações cortadas em 600 para a cota). */
export function writeRelatoriosCache(usuarioId, sig, transacoes) {
  const lista = Array.isArray(transacoes) ? transacoes.slice(0, 600) : []
  cache.write(usuarioId, { sig, transacoes: lista })
}

export const clearRelatoriosCache = cache.clear
