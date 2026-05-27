import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../context/ThemeContext'
import { useTransactionCache, TRANSACOES_REVALIDATED_EVENT } from '../context/transactionCacheStore'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import {
  familiaMostrarQuemLancouNaUi,
  readHorizonteUser,
  readHorizonteUserPainelState,
  readHorizonteUserProfile,
  horizonteUserProfileTemId,
  subscribeHorizonteSessionRefresh,
} from '../lib/horizonteSession'
import { redirectSe401, redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { SkeletonTxRow } from '../components/dashboard/DashboardSkeletons'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { getWhatsappContactUrl } from '../lib/whatsappContactUrl.js'
import { TransacaoRow } from '../components/transacoes/TransacaoRow'
import { TransacoesFiltrosPanel } from '../components/transacoes/TransacoesFiltrosPanel'
import './dashboard.css'

/** Itens por requisição — menos DOM inicial; “Carregar mais” busca o restante. */
const TX_PAGE_SIZE = 80

export default function Transacoes() {
  const { privacyMode, togglePrivacy } = useTheme()
  const [usuario, setUsuario] = useState(() => readHorizonteUserPainelState())

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) setUsuario((prev) => ({ ...prev, ...u }))
  }, [])

  useEffect(() => {
    return subscribeHorizonteSessionRefresh((u) => {
      if (u) setUsuario((prev) => ({ ...prev, ...u }))
    })
  }, [])

  const mostrarQuemLancou = useMemo(() => familiaMostrarQuemLancouNaUi(usuario), [usuario])

  // States
  const { transacoes: cachedTx, fetchTransacoes: syncGlobalCache } = useTransactionCache()

  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  
  // Inicializa com o cache global para evitar "saltos" de tela (SWR)
  const [transacoes, setTransacoes] = useState(cachedTx || [])
  const [categorias, setCategorias] = useState([])
  const firstFetchDoneRef = useRef(false)
  const fetchTransacoesRef = useRef(null)
  const filterChangeSkipRef = useRef(true)
  const scrollContainerRef = useRef(null)
  const txLoadMoreSentinelRef = useRef(null)
  const [useDesktopTxGrid, setUseDesktopTxGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches,
  )
  
  // Só exibe Skeleton se o cache estiver vazio
  const [loading, setLoading] = useState(() => 
    horizonteUserProfileTemId(readHorizonteUserProfile()) && (!cachedTx || cachedTx.length === 0)
  )
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [recorrencias, setRecorrencias] = useState([])
  const [confirmDialog, setConfirmDialog] = useState(null)
  // Grupos expandidos no modo "Parceladas" (Set de recorrente_grupo_id)
  const [parceladosExpandidos, setParceladosExpandidos] = useState(() => new Set())

  // Filters State
  const [filters, setFilters] = useState({
    busca: '',
    tipo: '',
    categoria_id: '',
    dataInicio: '',
    dataFim: '',
    /** '' = todos · 'recorrentes' = só parcelas / repetição mensal (API recorrentes=1) */
    lancamentos: '',
  })

  const fetchCategorias = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await apiFetch(apiUrl('/api/categorias'), {
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) {
      console.error('[Transacoes] fetchCategorias:', err)
    }
  }, [])

  const fetchRecorrencias = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await apiFetch(apiUrl('/api/recorrencias-mensais'), {
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        setRecorrencias(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('[Transacoes] fetchRecorrencias:', err)
    }
  }, [])

  const buildTxQuery = useCallback(
    (offset) => {
      const params = new URLSearchParams()
      if (filters.busca) params.append('busca', filters.busca)
      if (filters.tipo) params.append('tipo', filters.tipo)
      if (filters.categoria_id) params.append('categoria_id', filters.categoria_id)
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.append('dataFim', filters.dataFim)
      if (filters.lancamentos === 'recorrentes') params.append('recorrentes', '1')
      if (filters.lancamentos === 'parceladas') params.append('parceladas', '1')
      params.append('limit', String(TX_PAGE_SIZE))
      params.append('offset', String(offset))
      return params
    },
    [filters]
  )

  const fetchTransacoes = useCallback(async () => {
    const isInitial = !firstFetchDoneRef.current
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setHasMore(false)
    const session = readHorizonteUser()
    if (!session?.id) {
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      void syncRecorrenciasMensais(session.id)
      const res = await fetchWithRetry(
        apiUrl(`/api/transacoes?${buildTxQuery(0).toString()}`),
        { cache: 'no-store' },
        { fetchImpl: apiFetch },
      )
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        setTransacoes(rows)
        setHasMore(rows.length === TX_PAGE_SIZE)
      }
    } catch (err) {
      console.error('[Transacoes] fetchTransacoes:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstFetchDoneRef.current = true
    }
  }, [buildTxQuery])

  // Mantém ref sempre atualizada sem precisar de dep no useEffect abaixo
  fetchTransacoesRef.current = fetchTransacoes

  const loadMoreTransacoes = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return
    const session = readHorizonteUser()
    if (!session?.id) return
    setLoadingMore(true)
    try {
      const offset = transacoes.length
      const res = await fetchWithRetry(
        apiUrl(`/api/transacoes?${buildTxQuery(offset).toString()}`),
        { cache: 'no-store' },
        { fetchImpl: apiFetch },
      )
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        setTransacoes((prev) => [...prev, ...rows])
        setHasMore(rows.length === TX_PAGE_SIZE)
      }
    } catch (err) {
      console.error('[Transacoes] loadMoreTransacoes:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [loading, refreshing, loadingMore, hasMore, transacoes.length, buildTxQuery])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)')
    const sync = () => setUseDesktopTxGrid(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const virtualizer = useVirtualizer({
    count: useDesktopTxGrid ? 0 : transacoes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 172,
    gap: 14,
    overscan: 5,
  })

  // Reset de estado ao trocar de usuário
  useEffect(() => {
    firstFetchDoneRef.current = false
    filterChangeSkipRef.current = true
  }, [usuario.id])

  // Carga inicial: dispara imediatamente sem depender de fetchTransacoes
  // (que muda a cada alteração de filtro — evita re-runs desnecessários)
  useEffect(() => {
    const session = readHorizonteUser()
    if (session?.id) {
      fetchCategorias()
      fetchTransacoesRef.current()
      fetchRecorrencias()
    }
  }, [usuario.id, fetchCategorias, fetchRecorrencias])

  // Filtros: debounce de 400ms para evitar fetch a cada tecla
  useEffect(() => {
    if (filterChangeSkipRef.current) {
      filterChangeSkipRef.current = false
      return
    }
    const t = setTimeout(() => void fetchTransacoesRef.current?.(), 400)
    return () => clearTimeout(t)
  }, [filters])

  // Infinite scroll (mobile virtualizado): carrega mais quando último item virtual fica visível
  const virtualItems = virtualizer.getVirtualItems()
  const lastVirtualIndex = virtualItems[virtualItems.length - 1]?.index ?? -1
  useEffect(() => {
    if (useDesktopTxGrid) return
    if (
      lastVirtualIndex >= transacoes.length - 1 &&
      hasMore &&
      !loadingMore &&
      !loading &&
      !refreshing
    ) {
      void loadMoreTransacoes()
    }
  // loadMoreTransacoes é omitido de propósito: suas deps internas (loading,
  // refreshing, loadingMore, hasMore, transacoes.length, buildTxQuery) já
  // disparam o efeito por outras vias. Adicioná-lo ao array criaria um trigger
  // duplicado a cada recomposição do useCallback, sem mudança de comportamento.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDesktopTxGrid, lastVirtualIndex, hasMore, loadingMore, loading, refreshing, transacoes.length])

  // Infinite scroll (desktop — linhas são filhos diretos da grelha de cartões)
  useEffect(() => {
    if (!useDesktopTxGrid || !hasMore || loading || refreshing || loadingMore) return
    const root = scrollContainerRef.current
    const target = txLoadMoreSentinelRef.current
    if (!root || !target) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreTransacoes()
      },
      { root, rootMargin: '240px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [useDesktopTxGrid, hasMore, loading, refreshing, loadingMore, transacoes.length, loadMoreTransacoes])

  /** Lista filtrada: alinhar ao cache global quando há novo fetch (ex.: despesa/receita pelo WhatsApp). */
  useEffect(() => {
    const onRevalidated = () => {
      const session = readHorizonteUser()
      if (!session?.id) return
      void fetchTransacoes()
    }
    window.addEventListener(TRANSACOES_REVALIDATED_EVENT, onRevalidated)
    return () => window.removeEventListener(TRANSACOES_REVALIDATED_EVENT, onRevalidated)
  }, [fetchTransacoes])

  const encerrarRecorrencia = async (id) => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await apiFetch(apiUrl(`/api/recorrencias-mensais/${id}`), {
        method: 'DELETE',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) fetchRecorrencias()
    } catch (err) {
      console.error('[Transacoes] encerrarRecorrencia:', err)
    }
  }

  const handleEncerrarRecorrencia = (id) => {
    setConfirmDialog({
      title: 'Encerrar repetição?',
      message: 'Este lançamento deixará de se repetir todo dia 1. As transações já criadas serão mantidas.',
      confirmLabel: 'Encerrar',
      onConfirm: () => encerrarRecorrencia(id),
    })
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const deleteTransacao = async (id) => {
    const session = readHorizonteUser()
    if (!session?.id) return

    // Otimista
    setTransacoes(prev => prev.filter(t => t.id !== id))

    try {
      const res = await apiFetch(apiUrl(`/api/transacoes/${id}`), {
        method: 'DELETE',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        syncGlobalCache({ silent: true })
      } else {
        fetchTransacoes()
      }
    } catch (err) {
      console.error('[Transacoes] deleteTransacao:', err)
      fetchTransacoes()
    }
  }

  const deleteGrupoParcelado = async (grupoId) => {
    const session = readHorizonteUser()
    if (!session?.id) return

    // Otimista: remove todas as parcelas do grupo do estado local
    setTransacoes(prev => prev.filter(t => t.recorrente_grupo_id !== grupoId))

    try {
      const res = await apiFetch(apiUrl(`/api/transacoes/grupo/${grupoId}`), {
        method: 'DELETE',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        syncGlobalCache({ silent: true })
      } else {
        fetchTransacoes()
      }
    } catch (err) {
      console.error('[Transacoes] deleteGrupoParcelado:', err)
      fetchTransacoes()
    }
  }

  const handleDelete = (transacao) => {
    if (transacao.recorrente_grupo_id) {
      setConfirmDialog({
        title: 'Excluir compra parcelada?',
        message: `Todas as parcelas de "${transacao.descricao?.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'sem descrição'}" serão removidas.`,
        confirmLabel: 'Excluir tudo',
        onConfirm: () => deleteGrupoParcelado(transacao.recorrente_grupo_id),
      })
      return
    }
    setConfirmDialog({
      title: 'Excluir transação?',
      message: `A transação "${transacao.descricao || 'sem descrição'}" será removida da sua lista.`,
      confirmLabel: 'Excluir',
      onConfirm: () => deleteTransacao(transacao.id),
    })
  }

  const clearFilters = () =>
    setFilters({
      busca: '',
      tipo: '',
      categoria_id: '',
      dataInicio: '',
      dataFim: '',
      lancamentos: '',
    })

  const filtroRecorrentesAtivo = filters.lancamentos === 'recorrentes'
  const filtroParceladasAtivo = filters.lancamentos === 'parceladas'

  const toggleParceladas = () =>
    setFilters((prev) => ({
      ...prev,
      lancamentos: prev.lancamentos === 'parceladas' ? '' : 'parceladas',
    }))

  // Agrupa lançamentos quando o filtro "Parceladas" está ativo:
  //  - kind 'parcelado': agrupado por recorrente_grupo_id (compra parcelada N×)
  //  - kind 'mensal':    agrupado por recorrencia_mensal_id (assinatura/stream
  //                      sem prazo, lançada com "Prazo indeterminado")
  // Cada grupo é renderizado como uma linha colapsável com seus pagamentos.
  const gruposParcelados = useMemo(() => {
    if (!filtroParceladasAtivo) return null
    const map = new Map()
    for (const t of transacoes) {
      let key = null
      let kind = null
      if (t.recorrente_grupo_id && t.recorrente_index) {
        key = `p:${t.recorrente_grupo_id}`
        kind = 'parcelado'
      } else if (t.recorrencia_mensal_id) {
        key = `m:${t.recorrencia_mensal_id}`
        kind = 'mensal'
      }
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          kind,
          group_id: t.recorrente_grupo_id || t.recorrencia_mensal_id,
          parcelas: [],
          valor_total: 0,
          tipo: t.tipo,
          recorrente_total: t.recorrente_total || null,
          categorias: t.categorias,
          subcategorias: t.subcategorias,
        })
      }
      const g = map.get(key)
      g.parcelas.push(t)
      g.valor_total += Math.abs(parseFloat(t.valor) || 0)
    }
    const out = []
    for (const g of map.values()) {
      if (g.kind === 'parcelado') {
        g.parcelas.sort((a, b) => (a.recorrente_index || 0) - (b.recorrente_index || 0))
      } else {
        // Recorrência mensal: ordena por data crescente para "1ª, 2ª…" aparecerem em ordem
        g.parcelas.sort((a, b) => new Date(a.data_transacao || 0) - new Date(b.data_transacao || 0))
      }
      const primeira = g.parcelas[0]
      g.descricao_base =
        (primeira?.descricao && String(primeira.descricao).replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()) ||
        (g.subcategorias?.nome && String(g.subcategorias.nome).trim()) ||
        (g.categorias?.nome && String(g.categorias.nome).trim()) ||
        (g.kind === 'mensal' ? 'Assinatura mensal' : 'Compra parcelada')
      g.data_inicio = primeira?.data_transacao || null
      out.push(g)
    }
    out.sort((a, b) => new Date(b.data_inicio || 0) - new Date(a.data_inicio || 0))
    return out
  }, [filtroParceladasAtivo, transacoes])

  // Totais agregados para o footer da aba Parceladas:
  // - totalMes: quanto vai sair no mês corrente (parcelas vencendo + valor
  //   mensal das recorrências indeterminadas ainda ativas).
  // - totalGeral: soma do valor total de todas as compras parceladas listadas.
  const totaisParcelados = useMemo(() => {
    if (!gruposParcelados) return null
    const agora = new Date()
    const ymAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
    let totalMes = 0
    let totalGeral = 0
    for (const g of gruposParcelados) {
      totalGeral += g.valor_total
      if (g.kind === 'mensal' && g.parcelas.length > 0) {
        // Assinatura/stream sem prazo: contabiliza o valor mensal mesmo que
        // o lançamento do mês atual ainda não tenha sido gerado pelo cron de
        // recorrências (evita o footer "esquecer" o gasto da assinatura).
        // Procura primeiro um lançamento já existente para o mês atual; se
        // não houver, usa o valor da última parcela como referência.
        let valorMes = 0
        for (const p of g.parcelas) {
          const d = p.data_transacao ? new Date(p.data_transacao) : null
          if (!d || Number.isNaN(d.getTime())) continue
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (ym === ymAtual) {
            valorMes = Math.abs(parseFloat(p.valor) || 0)
            break
          }
        }
        if (!valorMes) {
          const ultima = g.parcelas[g.parcelas.length - 1]
          valorMes = Math.abs(parseFloat(ultima?.valor) || 0)
        }
        totalMes += valorMes
      } else {
        // Parcelado fixo: só conta a parcela que vence no mês corrente.
        for (const p of g.parcelas) {
          const d = p.data_transacao ? new Date(p.data_transacao) : null
          if (!d || Number.isNaN(d.getTime())) continue
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (ym === ymAtual) totalMes += Math.abs(parseFloat(p.valor) || 0)
        }
      }
    }
    return { totalMes, totalGeral }
  }, [gruposParcelados])

  const toggleGrupoParcelado = useCallback((id) => {
    setParceladosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const whatsappContactUrl = useMemo(() => getWhatsappContactUrl(), [])

  return (
    <>
    <div className="dashboard-container dashboard-page page-transacoes ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll ref={scrollContainerRef}>
        <section className="dashboard-hub__hero" aria-label="Transações e atalhos">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
            <div className="dashboard-hub__hero-text">
              <h1 className="dashboard-hub__title">Transações</h1>
              <div className="dashboard-hub__balance-line" aria-live="polite">
                <span>
                  {loading
                    ? 'Carregando…'
                    : `${transacoes.length} ${transacoes.length === 1 ? 'lançamento' : 'lançamentos'}${hasMore ? ' · carregar mais' : ''}`}
                </span>
              </div>
            </div>
            <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Atalhos da página">
              <button
                type="button"
                className="dashboard-hub__btn dashboard-hub__btn--primary"
                onClick={() => {
                  setEditingTransaction(null)
                  setIsModalOpen(true)
                }}
              >
                + Nova transação
              </button>
              <a
                href={whatsappContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-hub__icon-btn dashboard-hub__icon-btn--wa"
                aria-label="Abrir WhatsApp"
                title="WhatsApp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <button
                type="button"
                className={`dashboard-hub__icon-btn dashboard-hub__icon-btn--privacy ${privacyMode ? 'dashboard-hub__icon-btn--privacy-on' : ''}`}
                onClick={togglePrivacy}
                aria-pressed={privacyMode}
                aria-label={privacyMode ? 'Mostrar valores (modo privacidade desligado)' : 'Ocultar valores (modo privacidade)'}
                title="Modo privacidade"
              >
                {privacyMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.733 5.076A10.744 10.744 0 0 1 12 5c7 0 10 7 10 7a13.165 13.165 0 0 1-1.555 2.665" />
                    <path d="M6.52 6.52A13.134 13.134 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 4.29-.973" />
                    <path d="M2 2l20 20" />
                    <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </section>

        <section className="ref-bottom-grid ref-bottom-grid--single page-transacoes-panels" aria-label="Filtros e transações">
        <TransacoesFiltrosPanel
          filters={filters}
          filtrosAbertos={filtrosAbertos}
          categorias={categorias}
          onToggle={() => setFiltrosAbertos((open) => !open)}
          onChange={handleFilterChange}
          onClearFilters={clearFilters}
          filtroParceladasAtivo={filtroParceladasAtivo}
          onToggleParceladas={toggleParceladas}
        />

        {filtroRecorrentesAtivo && (
          <article className="ref-panel page-transacoes-ref-recorrencias" aria-label="Regras de repetição no dia 1">
            <div className="ref-panel__head page-transacoes-rec-head">
              <div className="page-transacoes-rec-head__titles">
                <h2 className="ref-panel__title">Repetição mensal (dia 1)</h2>
                <p className="page-transacoes-rec-head__sub">
                  Regras ativas que geram lançamentos automáticos. A lista abaixo mostra as transações já registradas (parcelas ou recorrentes), conforme os filtros.
                </p>
              </div>
              <span className="page-transacoes-rec-head__flag">Dia 1</span>
            </div>
            {recorrencias.length === 0 ? (
              <p className="page-transacoes-rec-empty">
                Nenhuma regra de repetição no dia 1. Ao criar uma transação, marque &quot;Repetir todo mês neste dia&quot; para aparecer aqui.
              </p>
            ) : (
              <ul className="page-transacoes-recorrencias-list">
                {recorrencias.map((r) => {
                  const isRec = r.tipo === 'RECEITA'
                  const label = (r.descricao && String(r.descricao).trim()) || 'Sem descrição'
                  const valorAbs = Math.abs(parseFloat(r.valor) || 0)
                  return (
                    <li key={r.id} className="page-transacoes-recorrencia-row">
                      <div className="page-transacoes-recorrencia-row__main">
                        <div className="page-transacoes-recorrencia-row__text">
                          <span
                            className={`page-transacoes-recorrencia-row__tipo ${isRec ? 'page-transacoes-recorrencia-row__tipo--rec' : ''}`}
                          >
                            {isRec ? 'Receita' : 'Despesa'}
                          </span>
                          <span className="page-transacoes-recorrencia-row__desc break-words">{label}</span>
                        </div>
                        <span className={`page-transacoes-recorrencia-row__val ${privacyMode ? 'privacy-blur' : ''}`}>
                          {isRec ? '+' : '−'}
                          {formatCurrencyBRL(valorAbs)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="page-transacoes-recorrencia-row__stop"
                        onClick={() => handleEncerrarRecorrencia(r.id)}
                      >
                        Encerrar
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        )}

        <article
          className={`ref-panel ref-panel--transactions dashboard-hub__tx-panel page-transacoes-ref-table${refreshing ? ' page-panel--refreshing' : ''}${filtroParceladasAtivo ? ' page-transacoes-ref-table--parceladas' : ''}`}
        >
          <div className="ref-panel__head page-transacoes-tx-panel-head">
            <div className="page-transacoes-tx-panel-head__titles">
              <h2 className="ref-panel__title">
                {filtroParceladasAtivo ? 'Compras parceladas' : 'Transações'}
              </h2>
              {filtroRecorrentesAtivo ? (
                <p className="ref-panel__subtitle page-transacoes-tx-filter-hint">
                  Exibindo só lançamentos com parcelamento ou repetição mensal.
                </p>
              ) : null}
              {filtroParceladasAtivo ? (
                <p className="ref-panel__subtitle page-transacoes-tx-filter-hint">
                  Toque em uma compra para ver as parcelas.
                </p>
              ) : null}
            </div>
          </div>
          <div className="ref-tx-list" aria-busy={loading || refreshing}>
            {loading ? (
              <div className="skeleton-stagger ref-tx-skeleton-stack">
                <SkeletonTxRow />
                <SkeletonTxRow />
                <SkeletonTxRow />
                <SkeletonTxRow />
                <SkeletonTxRow />
                <SkeletonTxRow />
              </div>
            ) : transacoes.length === 0 ? (
              <div className="ref-empty-state">
                <p className="ref-empty">
                  {filtroParceladasAtivo
                    ? 'Nenhuma compra parcelada encontrada.'
                    : filtroRecorrentesAtivo
                    ? 'Nenhum lançamento recorrente encontrado com os filtros atuais (período, busca ou categoria).'
                    : 'Nenhuma transação encontrada com os filtros atuais.'}
                </p>
                <button type="button" className="ref-empty-cta" onClick={clearFilters}>
                  Limpar filtros
                </button>
              </div>
            ) : filtroParceladasAtivo && gruposParcelados ? (
              <ul className="page-transacoes-parcelados-list">
                {gruposParcelados.map((g) => {
                  const expandido = parceladosExpandidos.has(g.id)
                  const isRec = g.tipo === 'RECEITA'
                  const isMensal = g.kind === 'mensal'
                  const catNome = (g.categorias?.nome && String(g.categorias.nome).trim()) || '—'
                  const subNome =
                    g.subcategorias?.nome && String(g.subcategorias.nome).trim()
                      ? String(g.subcategorias.nome).trim()
                      : ''
                  // Texto do contador: "10×" para parcelado, "Mensal · sem prazo" para recorrência indeterminada
                  const contadorLabel = isMensal
                    ? `Mensal · sem prazo · ${g.parcelas.length}${g.parcelas.length === 1 ? ' lançamento' : ' lançamentos'}`
                    : `${g.recorrente_total}×`
                  // Valor mostrado no cabeçalho: parcelado = total da compra; mensal = valor mensal
                  const valorCabecalho = isMensal
                    ? Math.abs(parseFloat(g.parcelas[0]?.valor) || 0)
                    : g.valor_total
                  return (
                    <li key={g.id} className={`page-transacoes-parcelado-grupo${expandido ? ' page-transacoes-parcelado-grupo--open' : ''}${isMensal ? ' page-transacoes-parcelado-grupo--mensal' : ''}`}>
                      <button
                        type="button"
                        className="page-transacoes-parcelado-grupo__head"
                        onClick={() => toggleGrupoParcelado(g.id)}
                        aria-expanded={expandido}
                        aria-controls={`parcelas-${g.id}`}
                      >
                        <span className="page-transacoes-parcelado-grupo__icon" aria-hidden>
                          {isMensal ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-3-6.7" />
                              <path d="M21 4v5h-5" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <path d="M2 10h20" />
                              <path d="M6 15h4M14 15h4" />
                            </svg>
                          )}
                        </span>
                        <div className="page-transacoes-parcelado-grupo__main">
                          <span className="page-transacoes-parcelado-grupo__desc">{g.descricao_base}</span>
                          <span className="page-transacoes-parcelado-grupo__meta">
                            {contadorLabel} · {catNome}
                            {subNome ? ` · ${subNome}` : ''}
                          </span>
                        </div>
                        <div className="page-transacoes-parcelado-grupo__right">
                          <span className={`page-transacoes-parcelado-grupo__valor${isRec ? ' page-transacoes-parcelado-grupo__valor--rec' : ''} ${privacyMode ? 'privacy-blur' : ''}`}>
                            {isRec ? '+' : '−'}
                            {formatCurrencyBRL(valorCabecalho)}
                            {isMensal ? <span className="page-transacoes-parcelado-grupo__valor-suf">/mês</span> : null}
                          </span>
                          <span className="page-transacoes-parcelado-grupo__chev" aria-hidden>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </div>
                      </button>
                      {expandido && (
                        <ul id={`parcelas-${g.id}`} className="page-transacoes-parcelado-grupo__parcelas">
                          {g.parcelas.map((p, idx) => {
                            const valorAbs = Math.abs(parseFloat(p.valor) || 0)
                            const isPendente = p.status === 'PENDENTE'
                            const dataObj = p.data_transacao ? new Date(p.data_transacao) : null
                            const dataLabel = dataObj && !Number.isNaN(dataObj.getTime())
                              ? dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
                              : '—'
                            return (
                              <li key={p.id} className="page-transacoes-parcelado-parcela">
                                <span className="page-transacoes-parcelado-parcela__idx">
                                  {isMensal
                                    ? `${idx + 1}ª`
                                    : `${p.recorrente_index}/${p.recorrente_total}`}
                                </span>
                                <span className="page-transacoes-parcelado-parcela__data">{dataLabel}</span>
                                <span className={`page-transacoes-parcelado-parcela__status${isPendente ? ' page-transacoes-parcelado-parcela__status--pendente' : ''}`}>
                                  {isPendente ? 'Pendente' : 'Pago'}
                                </span>
                                <span className={`page-transacoes-parcelado-parcela__valor ${privacyMode ? 'privacy-blur' : ''}`}>
                                  {formatCurrencyBRL(valorAbs)}
                                </span>
                                <div className="page-transacoes-parcelado-parcela__acoes" role="group">
                                  <button
                                    type="button"
                                    className="btn-edit"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingTransaction(p)
                                      setIsModalOpen(true)
                                    }}
                                    aria-label={isMensal
                                      ? `Editar lançamento ${idx + 1} de ${g.descricao_base}`
                                      : `Editar parcela ${p.recorrente_index}/${p.recorrente_total}`}
                                    title={isMensal ? 'Editar lançamento' : 'Editar parcela'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                      <path d="m15 5 4 4" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDelete(p)
                                    }}
                                    aria-label={isMensal
                                      ? `Excluir lançamento ${idx + 1} de ${g.descricao_base}`
                                      : `Excluir parcela ${p.recorrente_index}/${p.recorrente_total}`}
                                    title={isMensal ? 'Excluir lançamento' : 'Excluir parcela'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                      <path d="M3 6h18" />
                                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                    </svg>
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <>
              <div className="ref-tx-table-subgrid ref-tx-table-subgrid--actions tx-cal-grid">
                <div className="ref-tx-list-head">
                  <span className="ref-tx-list-head__icon" aria-hidden />
                  <span className="ref-tx-list-head__meta">{mostrarQuemLancou ? 'Data · quem lançou' : 'Data'}</span>
                  <span className="ref-tx-list-head__cat">Categoria</span>
                  <span className="ref-tx-list-head__sub">Subcategoria</span>
                  <span className="ref-tx-list-head__rec" aria-hidden="true" />
                  <span className="ref-tx-list-head__val">Valor</span>
                  <span className="ref-tx-list-head__actions">Ações</span>
                </div>
                {useDesktopTxGrid ? (
                  transacoes.map((t) => (
                    <TransacaoRow
                      key={t.id}
                      t={t}
                      mostrarQuemLancou={mostrarQuemLancou}
                      privacyMode={privacyMode}
                      onEdit={(tx) => {
                        setEditingTransaction(tx)
                        setIsModalOpen(true)
                      }}
                      onDelete={handleDelete}
                    />
                  ))
                ) : (
                  <div
                    className="ref-tx-virtual-scroll"
                    style={{
                      height: virtualizer.getTotalSize(),
                      position: 'relative',
                      gridColumn: '1 / -1',
                    }}
                  >
                    {virtualItems.map((vRow) => {
                      const t = transacoes[vRow.index]
                      return (
                        <div
                          key={vRow.key}
                          data-index={vRow.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${vRow.start}px)`,
                          }}
                        >
                          <TransacaoRow
                            t={t}
                            mostrarQuemLancou={mostrarQuemLancou}
                            privacyMode={privacyMode}
                            onEdit={(tx) => {
                              setEditingTransaction(tx)
                              setIsModalOpen(true)
                            }}
                            onDelete={handleDelete}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div ref={txLoadMoreSentinelRef} className="page-transacoes-load-more">
                <p className="page-transacoes-tx-meta" aria-live="polite">
                  {transacoes.length}{' '}
                  {transacoes.length === 1 ? 'transação' : 'transações'}
                  {loadingMore ? ' · carregando…' : hasMore ? ' · role para carregar mais' : ' · fim da lista'}
                </p>
              </div>
              </>
            )}
          </div>
        </article>
        </section>
        </RefDashboardScroll>

        {filtroParceladasAtivo && totaisParcelados && (
          <div className="page-transacoes-parcelados-footer" role="status" aria-live="polite">
            <div className="page-transacoes-parcelados-footer__item">
              <span className="page-transacoes-parcelados-footer__label">Mês atual</span>
              <strong className={`page-transacoes-parcelados-footer__value ${privacyMode ? 'privacy-blur' : ''}`}>
                {formatCurrencyBRL(totaisParcelados.totalMes)}
              </strong>
            </div>
            <div className="page-transacoes-parcelados-footer__divider" aria-hidden />
            <div className="page-transacoes-parcelados-footer__item">
              <span className="page-transacoes-parcelados-footer__label">Total parcelado</span>
              <strong className={`page-transacoes-parcelados-footer__value ${privacyMode ? 'privacy-blur' : ''}`}>
                {formatCurrencyBRL(totaisParcelados.totalGeral)}
              </strong>
            </div>
          </div>
        )}
        </div>
      </main>
      </div>
    </div>

    {!isModalOpen && (
      <div className="dashboard-mobile-fabs">
        <button
          type="button"
          className="dashboard-mobile-tx-fab"
          onClick={() => {
            setEditingTransaction(null)
            setIsModalOpen(true)
          }}
          aria-label="Criar nova transação"
        >
          <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <span className="dashboard-mobile-tx-fab__label">Nova transação</span>
        </button>
      </div>
    )}

    <TransactionModal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false)
        setEditingTransaction(null)
      }}
      onSave={() => {
        void (async () => {
          await fetchTransacoes()
          await fetchRecorrencias()
          syncGlobalCache({ silent: true })
        })()
      }}
      usuarioId={readHorizonteUser()?.id || usuario.id}
      editingTransaction={editingTransaction}
    />
    <ConfirmDialog
      open={Boolean(confirmDialog)}
      title={confirmDialog?.title}
      message={confirmDialog?.message}
      confirmLabel={confirmDialog?.confirmLabel}
      onConfirm={confirmDialog?.onConfirm}
      onClose={() => setConfirmDialog(null)}
    />
    </>
  )
}
