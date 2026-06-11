import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../context/ThemeContext'
import { useTransactionCache, TRANSACOES_REVALIDATED_EVENT } from '../context/transactionCacheStore'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import {
  familiaMostrarQuemLancouNaUi,
  readHorizonteUser,
  readHorizonteUserPainelState,
  readHorizonteUserProfile,
  horizonteUserProfileTemId,
  subscribeHorizonteSessionRefresh,
} from '../lib/horizonteSession'
import { redirectSeAuthBloqueada } from '../lib/authRedirect'
import { fetchCategorias as fetchCategoriasApi } from '../lib/apiCategorias'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { SkeletonTxRow } from '../components/dashboard/DashboardSkeletons'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { TransacaoRow } from '../components/transacoes/TransacaoRow'
import { TransacaoDetalheModal } from '../components/transacoes/TransacaoDetalheModal'
import { ParceladoGroup } from '../components/transacoes/ParceladoGroup'
import { TransacoesFiltrosPanel } from '../components/transacoes/TransacoesFiltrosPanel'
import { ImportarPlanilhaModal } from '../components/transacoes/ImportarPlanilhaModal'
import {
  construirGruposParcelados,
  filtrarGruposParcelados,
  segmentarGrupos,
  calcularTotaisParcelados,
  filtrarTransacoesVisiveis,
  agruparTransacoesPorDia,
  calcularQuickTotals,
} from '../lib/transacoesDerived'
import './dashboard.css'
import '../styles/pages/transacoes.css'

/** Itens por requisição — menos DOM inicial; “Carregar mais” busca o restante. */
const TX_PAGE_SIZE = 80

export default function Transacoes() {
  const { privacyMode } = useTheme()
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
  const [importModalOpen, setImportModalOpen] = useState(false)
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
    const data = await fetchCategoriasApi()
    if (data) setCategorias(data)
  }, [])

  const fetchRecorrencias = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await apiFetch(apiUrl('/api/recorrencias-mensais'), {
      })
      if (redirectSeAuthBloqueada(res)) return
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
      // syncRecorrenciasMensais é disparado pelo TransactionCacheProvider (mount + poll 45s),
      // app-level — não duplicar aqui. (Auditoria squad 2026-06, A10.)
      const res = await fetchWithRetry(
        apiUrl(`/api/transacoes?${buildTxQuery(0).toString()}`),
        { cache: 'no-store' },
        { fetchImpl: apiFetch },
      )
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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

  // Infinite scroll (desktop + mobile — lista agrupada com sentinela no rodapé)
  useEffect(() => {
    if (!hasMore || loading || refreshing || loadingMore) return
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

  // Mobile: FAB encolhe ao rolar + pull-to-refresh no topo da lista
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) return
    const root = scrollContainerRef.current
    if (!root) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setFabCompact(root.scrollTop > 36)
      })
    }

    // Pull-to-refresh
    let startY = 0
    let pulling = false
    const MAX_PULL = 90
    const TRIGGER = 64
    const onTouchStart = (e) => {
      if (root.scrollTop <= 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY
        pulling = true
      } else {
        pulling = false
      }
    }
    const onTouchMove = (e) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { setPullState((p) => (p.dist ? { dist: 0, active: false } : p)); return }
      if (root.scrollTop > 0) { pulling = false; setPullState({ dist: 0, active: false }); return }
      const dist = Math.min(dy * 0.5, MAX_PULL)
      if (dist > 4 && e.cancelable) e.preventDefault()
      setPullState({ dist, active: dist >= TRIGGER })
    }
    const onTouchEnd = () => {
      if (!pulling) return
      pulling = false
      setPullState((p) => {
        if (p.dist >= TRIGGER) {
          void (async () => {
            try {
              await fetchTransacoes()
              await fetchRecorrencias()
              syncGlobalCache({ silent: true })
            } finally {
              setPullState({ dist: 0, active: false })
            }
          })()
          return { dist: 36, active: true } // mantém leve enquanto recarrega
        }
        return { dist: 0, active: false }
      })
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    root.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [fetchTransacoes, fetchRecorrencias, syncGlobalCache])

  const encerrarRecorrencia = async (id) => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await apiFetch(apiUrl(`/api/recorrencias-mensais/${id}`), {
        method: 'DELETE',
      })
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
  // Pacote Parceladas — novos estados
  const [parcSearch, setParcSearch] = useState('')
  const [parcSort, setParcSort] = useState('recent') // 'recent' | 'value' | 'parcels' | 'progress'
  const [parcStatusFilter, setParcStatusFilter] = useState(null) // 'em-dia' | 'atrasadas' | 'concluidas' | 'proximas' | null
  const [parceladosExpandAll, setParceladosExpandAll] = useState(false)

  const gruposParcelados = useMemo(() => {
    if (!filtroParceladasAtivo) return null
    return construirGruposParcelados(transacoes)
  }, [filtroParceladasAtivo, transacoes])

  // Aplica search + status filter + sort em cima dos grupos
  const gruposParceladosVisiveis = useMemo(
    () => filtrarGruposParcelados(gruposParcelados, parcSearch, parcStatusFilter, parcSort),
    [gruposParcelados, parcSearch, parcStatusFilter, parcSort],
  )

  // Segmenta em Parcelados e Mensais
  const gruposPorSegmento = useMemo(() => segmentarGrupos(gruposParceladosVisiveis), [gruposParceladosVisiveis])

  // PATCH status da parcela (Marcar paga inline)
  const marcarParcelaPaga = useCallback(async (parcela) => {
    if (!parcela || parcela.status !== 'PENDENTE') return
    // Otimista
    setTransacoes((prev) => prev.map((t) => (t.id === parcela.id ? { ...t, status: 'PAGO' } : t)))
    try {
      const res = await apiFetch(apiUrl(`/api/transacoes/${parcela.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAGO' }),
      })
      if (redirectSeAuthBloqueada(res)) return
      if (res.ok) syncGlobalCache({ silent: true })
      else fetchTransacoes()
    } catch (err) {
      console.error('[Transacoes] marcarParcelaPaga:', err)
      fetchTransacoes()
    }
  }, [syncGlobalCache])

  // Quitar antecipado — marca todas as parcelas futuras (pendentes) do grupo como pagas
  const quitarAntecipado = useCallback((grupo) => {
    if (!grupo) return
    const pendentes = grupo.parcelas.filter((p) => p.status === 'PENDENTE')
    if (pendentes.length === 0) return
    setConfirmDialog({
      title: `Quitar ${pendentes.length} ${pendentes.length === 1 ? 'parcela' : 'parcelas'} antecipadamente?`,
      message: `Todas as parcelas pendentes de "${grupo.descricao_base}" serão marcadas como pagas.`,
      confirmLabel: 'Quitar tudo',
      onConfirm: async () => {
        for (const p of pendentes) {
          await marcarParcelaPaga(p)
        }
      },
    })
  }, [marcarParcelaPaga])

  // Toggle expand all
  const toggleExpandAll = useCallback(() => {
    if (parceladosExpandAll || parceladosExpandidos.size > 0) {
      setParceladosExpandidos(new Set())
      setParceladosExpandAll(false)
    } else {
      const all = new Set((gruposParceladosVisiveis || []).map((g) => g.id))
      setParceladosExpandidos(all)
      setParceladosExpandAll(true)
    }
  }, [parceladosExpandAll, parceladosExpandidos, gruposParceladosVisiveis])

  // Totais agregados para o footer da aba Parceladas:
  // - totalMes: quanto vai sair no mês corrente (parcelas vencendo + valor
  //   mensal das recorrências indeterminadas ainda ativas).
  // - totalGeral: soma do valor total de todas as compras parceladas listadas.
  const totaisParcelados = useMemo(() => calcularTotaisParcelados(gruposParcelados), [gruposParcelados])

  const toggleGrupoParcelado = useCallback((id) => {
    setParceladosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Pacote 3 — estados de busca inline, quick-filter e multi-select
  const [quickSearch, setQuickSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState(null) // 'hoje' | '7d' | 'receitas' | 'despesas' | 'pendentes' | null
  const [selectedTxIds, setSelectedTxIds] = useState(() => new Set())
  // Mobile: FAB encolhe ao rolar p/ baixo; pull-to-refresh no topo
  const [fabCompact, setFabCompact] = useState(false)
  const [pullState, setPullState] = useState({ dist: 0, active: false })
  // Detalhes da transação (tap na linha)
  const [detalheTx, setDetalheTx] = useState(null)

  const toggleTxSelected = useCallback((id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedTxIds(new Set()), [])

  // Filtra client-side aplicando quickSearch + quickFilter sobre o array já carregado
  const transacoesVisiveis = useMemo(
    () => filtrarTransacoesVisiveis(transacoes, quickSearch, quickFilter),
    [transacoes, quickSearch, quickFilter],
  )

  // Agrupa transações por dia para renderizar com day-divider sticky
  const transacoesPorDia = useMemo(() => agruparTransacoesPorDia(transacoesVisiveis), [transacoesVisiveis])

  // Resumo do filtro atual (entradas/saídas/saldo) — exibido no topo da lista (mobile)
  const quickTotals = useMemo(() => calcularQuickTotals(transacoesVisiveis), [transacoesVisiveis])

  // Bulk delete: mata 1 a 1 (sem endpoint batch) e abre confirm
  const handleBulkDelete = useCallback(() => {
    if (selectedTxIds.size === 0) return
    setConfirmDialog({
      title: `Excluir ${selectedTxIds.size} ${selectedTxIds.size === 1 ? 'transação' : 'transações'}?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: `Excluir ${selectedTxIds.size}`,
      onConfirm: async () => {
        const ids = Array.from(selectedTxIds)
        for (const id of ids) {
          try {
            await deleteTransacao(id)
          } catch {
            // continua mesmo se falhar uma
          }
        }
        clearSelection()
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTxIds, clearSelection])

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
              <button
                type="button"
                className="dashboard-hub__btn dashboard-hub__btn--secondary"
                onClick={() => setImportModalOpen(true)}
                title="Importar planilha ou extrato bancário"
                aria-label="Importar planilha ou extrato bancário"
              >
                <svg className="dashboard-hub__btn-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
                <span className="dashboard-hub__btn-label">Importar</span>
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
                        aria-label={`Encerrar repetição de ${label}`}
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
              <div className="tx-title-row">
                <h2 className="ref-panel__title">
                  {filtroParceladasAtivo ? 'Compras parceladas' : 'Transações'}
                </h2>
                {!filtroParceladasAtivo && !loading && transacoes.length > 0 && (
                  <span
                    className={`tx-count-badge${quickSearch || quickFilter ? ' tx-count-badge--filtered' : ''}`}
                    aria-live="polite"
                    title={
                      quickSearch || quickFilter
                        ? `Exibindo ${transacoesVisiveis.length} de ${transacoes.length} lançamentos`
                        : `${transacoes.length} ${transacoes.length === 1 ? 'lançamento' : 'lançamentos'}`
                    }
                  >
                    {quickSearch || quickFilter ? (
                      <>
                        {transacoesVisiveis.length}
                        <span className="tx-count-badge__total"> de {transacoes.length}</span> lançamentos
                      </>
                    ) : (
                      <>
                        {transacoes.length} {transacoes.length === 1 ? 'lançamento' : 'lançamentos'}
                      </>
                    )}
                  </span>
                )}
              </div>
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
            {/* K — Busca rápida inline (escondida no modo Parceladas — usa parc-controls própria) */}
            {!filtroParceladasAtivo && (
              <div className="tx-quick-search" role="search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  placeholder="Buscar descrição, categoria…"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  aria-label="Buscar transações"
                />
                {quickSearch ? (
                  <button
                    type="button"
                    className="tx-quick-search__clear"
                    onClick={() => setQuickSearch('')}
                    aria-label="Limpar busca"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {/* L — Quick filter chips (escondidos no modo Parceladas — usa parc-status-chips própria) */}
          {!filtroParceladasAtivo && (
            <div className="tx-quick-filters" role="toolbar" aria-label="Filtros rápidos">
              {[
                { id: 'hoje', label: 'Hoje' },
                { id: '7d', label: '7 dias' },
                { id: '30d', label: '30 dias' },
                { id: 'receitas', label: 'Receitas' },
                { id: 'despesas', label: 'Despesas' },
                { id: 'pendentes', label: 'Pendentes' },
              ].map((qf) => (
                <button
                  key={qf.id}
                  type="button"
                  className={`tx-quick-chip${quickFilter === qf.id ? ' tx-quick-chip--active' : ''}`}
                  onClick={() => setQuickFilter(quickFilter === qf.id ? null : qf.id)}
                  aria-pressed={quickFilter === qf.id}
                >
                  {qf.label}
                </button>
              ))}
              {(quickSearch || quickFilter) && (
                <button
                  type="button"
                  className="tx-quick-chip tx-quick-chip--reset"
                  onClick={() => { setQuickSearch(''); setQuickFilter(null) }}
                >
                  Limpar
                </button>
              )}
            </div>
          )}
          {!filtroParceladasAtivo && !loading && quickTotals.count > 0 && (
            <div className="tx-quick-summary" role="status" aria-label="Resumo do filtro atual">
              <div className="tx-quick-summary__item">
                <span className="tx-quick-summary__label">Entradas</span>
                <span className={`tx-quick-summary__value tx-quick-summary__value--in ${privacyMode ? 'privacy-blur' : ''}`}>
                  +{formatCurrencyBRL(quickTotals.entradas)}
                </span>
              </div>
              <div className="tx-quick-summary__item">
                <span className="tx-quick-summary__label">Saídas</span>
                <span className={`tx-quick-summary__value tx-quick-summary__value--out ${privacyMode ? 'privacy-blur' : ''}`}>
                  −{formatCurrencyBRL(quickTotals.saidas)}
                </span>
              </div>
              <div className="tx-quick-summary__item">
                <span className="tx-quick-summary__label">Saldo</span>
                <span className={`tx-quick-summary__value ${quickTotals.saldo >= 0 ? 'tx-quick-summary__value--in' : 'tx-quick-summary__value--out'} ${privacyMode ? 'privacy-blur' : ''}`}>
                  {quickTotals.saldo >= 0 ? '+' : '−'}{formatCurrencyBRL(Math.abs(quickTotals.saldo))}
                </span>
              </div>
            </div>
          )}
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
              <>
              {/* Pacote Parceladas — controles topo */}
              <div className="parc-controls">
                <div className="tx-quick-search" role="search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Buscar parceladas…"
                    value={parcSearch}
                    onChange={(e) => setParcSearch(e.target.value)}
                    aria-label="Buscar compras parceladas"
                  />
                  {parcSearch ? (
                    <button type="button" className="tx-quick-search__clear" onClick={() => setParcSearch('')} aria-label="Limpar busca">×</button>
                  ) : null}
                </div>
                <select className="parc-sort" value={parcSort} onChange={(e) => setParcSort(e.target.value)} aria-label="Ordenar">
                  <option value="recent">Mais recente</option>
                  <option value="value">Maior valor</option>
                  <option value="parcels">Mais parcelas</option>
                  <option value="progress">% concluído</option>
                </select>
                <button type="button" className="parc-expand-all" onClick={toggleExpandAll}>
                  {(parceladosExpandAll || parceladosExpandidos.size > 0) ? 'Recolher todas' : 'Expandir todas'}
                </button>
              </div>

              <div className="parc-status-chips" role="toolbar" aria-label="Filtros de status">
                {[
                  { id: 'em-dia', label: 'Em dia' },
                  { id: 'atrasadas', label: 'Atrasadas' },
                  { id: 'concluidas', label: 'Concluídas' },
                  { id: 'proximas', label: 'Próximas a vencer' },
                ].map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    className={`tx-quick-chip${parcStatusFilter === sf.id ? ' tx-quick-chip--active' : ''}`}
                    onClick={() => setParcStatusFilter(parcStatusFilter === sf.id ? null : sf.id)}
                    aria-pressed={parcStatusFilter === sf.id}
                  >
                    {sf.label}
                  </button>
                ))}
                {(parcSearch || parcStatusFilter) && (
                  <button
                    type="button"
                    className="tx-quick-chip tx-quick-chip--reset"
                    onClick={() => { setParcSearch(''); setParcStatusFilter(null) }}
                  >
                    Limpar
                  </button>
                )}
              </div>

              {gruposPorSegmento && (gruposPorSegmento.parcelados.length === 0 && gruposPorSegmento.mensais.length === 0) ? (
                <div className="ref-empty-state">
                  <p className="ref-empty">Nenhuma compra parcelada encontrada com esses filtros.</p>
                </div>
              ) : null}

              {gruposPorSegmento && gruposPorSegmento.parcelados.length > 0 && (
                <>
                <h3 className="parc-segment-title">Parceladas <span className="parc-segment-title__count">{gruposPorSegmento.parcelados.length}</span></h3>
                <ul className="page-transacoes-parcelados-list">
                  {gruposPorSegmento.parcelados.map((g) => (
                    <ParceladoGroup key={g.id} g={g}
                      isMensal={false}
                      expandido={parceladosExpandidos.has(g.id)}
                      onToggle={() => toggleGrupoParcelado(g.id)}
                      onMarcarPaga={marcarParcelaPaga}
                      onQuitarAntecipado={() => quitarAntecipado(g)}
                      onEditParcela={(p) => { setEditingTransaction(p); setIsModalOpen(true) }}
                      onEditGrupo={() => { setEditingTransaction(g.parcelas[0]); setIsModalOpen(true) }}
                      onDeleteParcela={handleDelete}
                      privacyMode={privacyMode}
                    />
                  ))}
                </ul>
                </>
              )}

              {gruposPorSegmento && gruposPorSegmento.mensais.length > 0 && (
                <>
                <h3 className="parc-segment-title">Assinaturas mensais <span className="parc-segment-title__count">{gruposPorSegmento.mensais.length}</span></h3>
                <ul className="page-transacoes-parcelados-list">
                  {gruposPorSegmento.mensais.map((g) => (
                    <ParceladoGroup key={g.id} g={g}
                      isMensal={true}
                      expandido={parceladosExpandidos.has(g.id)}
                      onToggle={() => toggleGrupoParcelado(g.id)}
                      onMarcarPaga={marcarParcelaPaga}
                      onQuitarAntecipado={() => quitarAntecipado(g)}
                      onEditParcela={(p) => { setEditingTransaction(p); setIsModalOpen(true) }}
                      onEditGrupo={() => { setEditingTransaction(g.parcelas[0]); setIsModalOpen(true) }}
                      onDeleteParcela={handleDelete}
                      privacyMode={privacyMode}
                    />
                  ))}
                </ul>
                </>
              )}
              </>
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
                {transacoesPorDia.map((grupo) => (
                    <React.Fragment key={grupo.key}>
                      <div className="tx-day-divider" role="separator" aria-label={`Transações de ${grupo.label}`}>
                        <span className="tx-day-divider__label">{grupo.label}</span>
                        <span
                          className="tx-day-divider__count"
                          title={`${grupo.txs.length} ${grupo.txs.length === 1 ? 'lançamento' : 'lançamentos'}`}
                          aria-label={`${grupo.txs.length} ${grupo.txs.length === 1 ? 'lançamento' : 'lançamentos'}`}
                        >
                          {grupo.txs.length}
                        </span>
                        <span className="tx-day-divider__totals">
                          {grupo.totalReceitas > 0 ? (
                            <span className={`tx-day-divider__total tx-day-divider__total--pos ${privacyMode ? 'privacy-blur' : ''}`}>
                              +{formatCurrencyBRL(grupo.totalReceitas)}
                            </span>
                          ) : null}
                          {grupo.totalDespesas > 0 ? (
                            <span className={`tx-day-divider__total tx-day-divider__total--neg ${privacyMode ? 'privacy-blur' : ''}`}>
                              −{formatCurrencyBRL(grupo.totalDespesas)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {grupo.txs.map((t) => (
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
                          onOpenDetail={setDetalheTx}
                          selected={selectedTxIds.has(t.id)}
                          onToggleSelect={() => toggleTxSelected(t.id)}
                          selectionMode={selectedTxIds.size > 0}
                        />
                      ))}
                    </React.Fragment>
                  ))}
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
          {filtroParceladasAtivo && totaisParcelados ? (
            <div className="page-transacoes-parcelados-footer parc-footer-4" role="status" aria-live="polite">
              <div className="page-transacoes-parcelados-footer__item">
                <span className="page-transacoes-parcelados-footer__label">Mês atual</span>
                <strong className={`page-transacoes-parcelados-footer__value ${privacyMode ? 'privacy-blur' : ''}`}>
                  {formatCurrencyBRL(totaisParcelados.totalMes)}
                </strong>
              </div>
              <div className="page-transacoes-parcelados-footer__divider" aria-hidden />
              <div className="page-transacoes-parcelados-footer__item">
                <span className="page-transacoes-parcelados-footer__label">Falta no mês</span>
                <strong className={`page-transacoes-parcelados-footer__value page-transacoes-parcelados-footer__value--warning ${privacyMode ? 'privacy-blur' : ''}`}>
                  {formatCurrencyBRL(totaisParcelados.faltaNoMes)}
                </strong>
              </div>
              <div className="page-transacoes-parcelados-footer__divider" aria-hidden />
              <div className="page-transacoes-parcelados-footer__item">
                <span className="page-transacoes-parcelados-footer__label">Total pago</span>
                <strong className={`page-transacoes-parcelados-footer__value page-transacoes-parcelados-footer__value--pos ${privacyMode ? 'privacy-blur' : ''}`}>
                  {formatCurrencyBRL(totaisParcelados.totalPago)}
                </strong>
              </div>
              <div className="page-transacoes-parcelados-footer__divider" aria-hidden />
              <div className="page-transacoes-parcelados-footer__item">
                <span className="page-transacoes-parcelados-footer__label">Total restante</span>
                <strong className={`page-transacoes-parcelados-footer__value page-transacoes-parcelados-footer__value--neg ${privacyMode ? 'privacy-blur' : ''}`}>
                  {formatCurrencyBRL(totaisParcelados.totalRestante)}
                </strong>
              </div>
            </div>
          ) : null}
        </article>
        </section>
        </RefDashboardScroll>
        </div>
        {/* O — Bulk action bar */}
        {selectedTxIds.size > 0 && (
          <div className="tx-bulk-bar" role="toolbar" aria-label="Ações em lote">
            <span className="tx-bulk-bar__count">
              {selectedTxIds.size} {selectedTxIds.size === 1 ? 'selecionada' : 'selecionadas'}
            </span>
            <button type="button" className="tx-bulk-bar__btn tx-bulk-bar__btn--neutral" onClick={clearSelection}>
              Limpar seleção
            </button>
            <button type="button" className="tx-bulk-bar__btn tx-bulk-bar__btn--danger" onClick={handleBulkDelete}>
              Excluir {selectedTxIds.size}
            </button>
          </div>
        )}
      </main>
      </div>
    </div>

    {pullState.dist > 0 && (
      <div
        className="tx-ptr"
        style={{ transform: `translateX(-50%) translateY(${pullState.dist}px)`, opacity: Math.min(1, pullState.dist / 56) }}
        aria-hidden
      >
        <svg className={`tx-ptr__spin${pullState.active ? ' tx-ptr__spin--active' : ''}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    )}

    {!isModalOpen && (
      <div className="dashboard-mobile-fabs">
        <button
          type="button"
          className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
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

    <TransacaoDetalheModal
      tx={detalheTx}
      onClose={() => setDetalheTx(null)}
      onEdit={(tx) => { setEditingTransaction(tx); setIsModalOpen(true) }}
      onDelete={handleDelete}
      privacyMode={privacyMode}
    />

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
    {importModalOpen && (
      <ImportarPlanilhaModal
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false)
          fetchTransacoesRef.current?.()
        }}
      />
    )}
    </>
  )
}
