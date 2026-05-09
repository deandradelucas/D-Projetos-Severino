/**
 * TransactionCache — Store SWR (Stale-While-Revalidate) para transações.
 *
 * Padrão: dados do cache são exibidos imediatamente (sem spinner),
 * enquanto a revalidação ocorre em background.
 *
 * Não usa biblioteca externa — apenas Context API nativo do React.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { apiUrl } from '../lib/apiUrl'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { readHorizonteUser } from '../lib/horizonteSession'
import { TransactionCacheContext, TRANSACOES_REVALIDATED_EVENT } from './transactionCacheStore'

/**
 * Provider — deve envolver o App (ou pelo menos as páginas autenticadas).
 */
export function TransactionCacheProvider({ children }) {
  // Cache central: array de transações (pode ter dados stale)
  const [transacoes, setTransacoes] = useState([])
  // true apenas no primeiro fetch — sem dados em cache ainda
  const [loadingInitial, setLoadingInitial] = useState(false)
  // true quando há revalidação silenciosa em background
  const [revalidating, setRevalidating] = useState(false)
  const [error, setError] = useState('')

  // Evita revalidações concorrentes
  const fetchingRef = useRef(false)
  // Indica se já carregou dados ao menos uma vez
  const hasDataRef = useRef(false)

  const fetchTransacoes = useCallback(async ({ silent = false } = {}) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    const session = readHorizonteUser()
    if (!session?.id) {
      setError('Sessão inválida. Faça login novamente.')
      fetchingRef.current = false
      return
    }

    // Se não temos nada em cache: mostra loading skeleton
    // Se já temos dados (stale): revalida silenciosamente
    if (!hasDataRef.current && !silent) {
      setLoadingInitial(true)
    } else {
      setRevalidating(true)
    }
    setError('')

    try {
      await syncRecorrenciasMensais(session.id)

      const res = await fetchWithRetry(apiUrl('/api/transacoes'), {
        headers: { 'x-user-id': String(session.id).trim() },
        cache: 'no-store',
      })

      if (redirectAssinaturaExpiradaSe403(res)) return

      if (res.ok) {
        const data = await res.json()
        setTransacoes(Array.isArray(data) ? data : [])
        hasDataRef.current = true
        setError('')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(TRANSACOES_REVALIDATED_EVENT))
        }
        return
      }

      const errBody = await res.json().catch(() => ({}))
      setError(errBody.message || `Erro ao carregar transações (${res.status}).`)
    } catch {
      setError('Sem conexão com a API. Verifique a internet.')
    } finally {
      setLoadingInitial(false)
      setRevalidating(false)
      fetchingRef.current = false
    }
  }, [])

  /**
   * Lançamentos pelo WhatsApp não chegam por push ao browser (API custom + x-user-id).
   * Revalidamos ao voltar ao separador e em intervalo curto com o app visível.
   */
  useEffect(() => {
    const POLL_MS = 45_000
    /** Evita revalidar transações em rotas onde o utilizador não usa o lançamentos (menos ruído na página Pagamento). */
    const shouldPollTransacoesPath = () => {
      if (typeof window === 'undefined') return false
      const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/'
      const skip = ['/pagamento', '/investimentos', '/login', '/cadastro', '/bem-vindo-assinatura']
      return !skip.includes(path)
    }
    let debounceVis
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!shouldPollTransacoesPath()) return
      const session = readHorizonteUser()
      if (!session?.id) return
      clearTimeout(debounceVis)
      debounceVis = window.setTimeout(() => void fetchTransacoes({ silent: true }), 450)
    }
    document.addEventListener('visibilitychange', onVisible)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!shouldPollTransacoesPath()) return
      const session = readHorizonteUser()
      if (!session?.id) return
      void fetchTransacoes({ silent: true })
    }, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(intervalId)
      clearTimeout(debounceVis)
    }
  }, [fetchTransacoes])

  /**
   * Adiciona uma transação localmente de forma otimista,
   * depois aciona revalidação silenciosa em background.
   */
  const addTransactionOptimistic = useCallback((newTx) => {
    if (newTx?.id) {
      setTransacoes((prev) => [newTx, ...prev])
    }
    // Revalida em background para garantir consistência com o servidor
    setTimeout(() => void fetchTransacoes({ silent: true }), 800)
  }, [fetchTransacoes])

  /**
   * Remove transação localmente e dispara revalidação silenciosa.
   */
  const removeTransactionOptimistic = useCallback((id) => {
    setTransacoes((prev) => prev.filter((t) => t.id !== id))
    setTimeout(() => void fetchTransacoes({ silent: true }), 800)
  }, [fetchTransacoes])

  /**
   * Atualiza transação localmente e dispara revalidação silenciosa.
   */
  const updateTransactionOptimistic = useCallback((updatedTx) => {
    if (!updatedTx?.id) return
    setTransacoes((prev) => prev.map((t) => (t.id === updatedTx.id ? { ...t, ...updatedTx } : t)))
    setTimeout(() => void fetchTransacoes({ silent: true }), 800)
  }, [fetchTransacoes])

  /**
   * Invalida o cache e força um fetch limpo (ex: ao trocar de usuário).
   */
  const invalidateCache = useCallback(() => {
    hasDataRef.current = false
    setTransacoes([])
    setError('')
  }, [])

  const value = {
    transacoes,
    loadingInitial,
    revalidating,
    error,
    hasData: hasDataRef.current,
    fetchTransacoes,
    addTransactionOptimistic,
    removeTransactionOptimistic,
    updateTransactionOptimistic,
    invalidateCache,
  }

  return (
    <TransactionCacheContext.Provider value={value}>
      {children}
    </TransactionCacheContext.Provider>
  )
}

