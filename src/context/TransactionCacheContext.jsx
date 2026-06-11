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
import { apiFetch } from '../lib/apiFetch'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import { redirectSeAuthBloqueada } from '../lib/authRedirect'
import { readHorizonteUser, subscribeHorizonteSessionRefresh } from '../lib/horizonteSession'
import { readTxCache, writeTxCache, clearTxCache } from '../lib/txCachePersist'
import { takeTransacoesPrefetch } from '../lib/dashboardPrefetch'
import { TransactionCacheContext, TRANSACOES_REVALIDATED_EVENT } from './transactionCacheStore'

/**
 * Provider — deve envolver o App (ou pelo menos as páginas autenticadas).
 */
export function TransactionCacheProvider({ children }) {
  // Cache central: array de transações (pode ter dados stale).
  // Hidrata do localStorage no cold start → pinta instantâneo, sem skeleton,
  // e revalida em background (SWR). Sem cache persistido, começa vazio.
  const [transacoes, setTransacoes] = useState(() => {
    const u = readHorizonteUser()
    const cached = u?.id ? readTxCache(u.id) : null
    return Array.isArray(cached) ? cached : []
  })
  // true apenas no primeiro fetch — sem dados em cache ainda
  const [loadingInitial, setLoadingInitial] = useState(false)
  // true quando há revalidação silenciosa em background
  const [revalidating, setRevalidating] = useState(false)
  const [error, setError] = useState('')

  // Evita revalidações concorrentes
  const fetchingRef = useRef(false)
  // Indica se já carregou dados ao menos uma vez (true se hidratou do cache)
  const hasDataRef = useRef(transacoes.length > 0)
  // Última versão conhecida das transações ("count:atualizado_em") — o poll só
  // baixa a lista completa quando este sinal muda.
  const versionRef = useRef(null)
  // Timer compartilhado pelas mutações otimistas (debounce de revalidação)
  const optimisticRevalidateTimerRef = useRef(0)

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
      void syncRecorrenciasMensais(session.id)

      // Fast-path: consome o prefetch disparado no login (request já em voo
      // enquanto o dashboard carregava) — evita iniciar outro fetch no mount.
      const pre = takeTransacoesPrefetch(session.id)
      if (pre) {
        const data = await pre
        if (Array.isArray(data)) {
          setTransacoes(data)
          writeTxCache(session.id, data)
          hasDataRef.current = true
          setError('')
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(TRANSACOES_REVALIDATED_EVENT))
          }
          return true
        }
      }

      const res = await fetchWithRetry(
        apiUrl('/api/transacoes'),
        { cache: 'no-store' },
        { fetchImpl: apiFetch },
      )

      if (redirectSeAuthBloqueada(res)) return

      if (res.ok) {
        const data = await res.json()
        const lista = Array.isArray(data) ? data : []
        setTransacoes(lista)
        writeTxCache(session.id, lista)
        hasDataRef.current = true
        setError('')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(TRANSACOES_REVALIDATED_EVENT))
        }
        return true
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
    return false
  }, [])

  /**
   * Sessão que chega DEPOIS da montagem (login no mesmo carregamento): hidrata o
   * cache persistido daquele usuário antes do fetch de rede retornar, para a UI
   * pintar instantâneo também nesse caminho.
   */
  useEffect(() => {
    return subscribeHorizonteSessionRefresh((u) => {
      if (!u?.id || hasDataRef.current) return
      const cached = readTxCache(u.id)
      if (Array.isArray(cached) && cached.length) {
        setTransacoes(cached)
        hasDataRef.current = true
      }
    })
  }, [])

  /**
   * Consulta o sinal leve de versão. Retorna "count:atualizado_em" ou null se a
   * sessão/endpoint não responderem (nesse caso o chamador simplesmente não age).
   */
  const fetchTxVersionSig = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return null
    try {
      const res = await apiFetch(apiUrl('/api/transacoes/version'), { cache: 'no-store' })
      if (!res.ok) return null
      const v = await res.json().catch(() => null)
      if (!v || typeof v !== 'object') return null
      return `${v.count ?? 0}:${v.latest ?? ''}`
    } catch {
      return null
    }
  }, [])

  /**
   * Revalida a lista SOMENTE se o sinal de versão mudou desde a última vez —
   * evita baixar ~centenas de linhas e re-renderizar tudo a cada 45s à toa.
   * Falha do endpoint de versão → não age (correção fica a cargo do fetch de
   * montagem / pull-to-refresh; é só uma otimização de background).
   */
  const revalidateIfChanged = useCallback(async () => {
    const sig = await fetchTxVersionSig()
    if (sig == null || versionRef.current === sig) return
    const ok = await fetchTransacoes({ silent: true })
    if (ok) versionRef.current = sig // só fixa após sucesso real (rede pode falhar)
  }, [fetchTxVersionSig, fetchTransacoes])

  /**
   * Lançamentos pelo WhatsApp não chegam por push ao browser (API custom + Bearer).
   * Revalidamos ao voltar ao separador e em intervalo curto com o app visível —
   * sempre atrás do gate de versão (poll leve antes de baixar tudo).
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
      debounceVis = window.setTimeout(() => void revalidateIfChanged(), 450)
    }
    document.addEventListener('visibilitychange', onVisible)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!shouldPollTransacoesPath()) return
      const session = readHorizonteUser()
      if (!session?.id) return
      void revalidateIfChanged()
    }, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(intervalId)
      clearTimeout(debounceVis)
    }
  }, [revalidateIfChanged])

  /**
   * Agenda a revalidação silenciosa após uma mutação otimista. Usa um único
   * timer compartilhado: várias mutações em sequência (ex.: lançar 3 transações
   * em 1 s) só geram um fetch ao final do debounce, e o cleanup do provider
   * garante que nada fica pendente após desmontagem.
   */
  const scheduleOptimisticRevalidate = useCallback(() => {
    window.clearTimeout(optimisticRevalidateTimerRef.current)
    optimisticRevalidateTimerRef.current = window.setTimeout(
      () => void fetchTransacoes({ silent: true }),
      800,
    )
  }, [fetchTransacoes])

  useEffect(
    () => () => window.clearTimeout(optimisticRevalidateTimerRef.current),
    [],
  )

  /**
   * Adiciona uma transação localmente de forma otimista,
   * depois aciona revalidação silenciosa em background.
   */
  const addTransactionOptimistic = useCallback((newTx) => {
    if (newTx?.id) {
      setTransacoes((prev) => [newTx, ...prev])
    }
    scheduleOptimisticRevalidate()
  }, [scheduleOptimisticRevalidate])

  /**
   * Remove transação localmente e dispara revalidação silenciosa.
   */
  const removeTransactionOptimistic = useCallback((id) => {
    setTransacoes((prev) => prev.filter((t) => t.id !== id))
    scheduleOptimisticRevalidate()
  }, [scheduleOptimisticRevalidate])

  /**
   * Atualiza transação localmente e dispara revalidação silenciosa.
   */
  const updateTransactionOptimistic = useCallback((updatedTx) => {
    if (!updatedTx?.id) return
    setTransacoes((prev) => prev.map((t) => (t.id === updatedTx.id ? { ...t, ...updatedTx } : t)))
    scheduleOptimisticRevalidate()
  }, [scheduleOptimisticRevalidate])

  /**
   * Invalida o cache e força um fetch limpo (ex: ao trocar de usuário).
   */
  const invalidateCache = useCallback(() => {
    hasDataRef.current = false
    versionRef.current = null
    const u = readHorizonteUser()
    if (u?.id) clearTxCache(u.id)
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

