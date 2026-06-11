/**
 * Prefetch das transações disparado no LOGIN — antes de navegar para o dashboard.
 *
 * Sem isto, a busca das transações só começa quando o dashboard monta (depois de
 * baixar o chunk + montar o provider): rede e mount acontecem em série. Disparando
 * no login, a request voa em paralelo ao carregamento da tela; o
 * TransactionCacheProvider consome o resultado em vez de iniciar outro fetch.
 *
 * Guarda uma única promessa pendente (por usuário), consumida uma vez.
 */
import { apiUrl } from './apiUrl'
import { apiFetch } from './apiFetch'

let pending = null // { userId: string, promise: Promise<Array|null> }

/** Dispara a busca das transações (fire-and-forget). Resolve em array ou null. */
export function startTransacoesPrefetch(userId) {
  const id = String(userId || '').trim()
  if (!id || typeof window === 'undefined') return
  const promise = (async () => {
    try {
      const res = await apiFetch(apiUrl('/api/transacoes'), { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      return Array.isArray(data) ? data : null
    } catch {
      return null
    }
  })()
  pending = { userId: id, promise }
}

/**
 * Consome (uma vez) o prefetch do usuário, se houver. Retorna a promessa ou null.
 * O chamador deve tratar resolução null (prefetch falhou → cair no fetch normal).
 */
export function takeTransacoesPrefetch(userId) {
  const id = String(userId || '').trim()
  if (!pending || pending.userId !== id) return null
  const p = pending.promise
  pending = null
  return p
}
