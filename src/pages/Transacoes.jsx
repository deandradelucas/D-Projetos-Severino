import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import RecorrenciaArrowIcon from '../components/RecorrenciaArrowIcon'
import { useTheme } from '../context/ThemeContext'
import { useTransactionCache } from '../context/transactionCacheStore'
import { apiUrl } from '../lib/apiUrl'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import {
  readHorizonteUser,
  readHorizonteUserPainelState,
  readHorizonteUserProfile,
  horizonteUserProfileTemId,
} from '../lib/horizonteSession'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { SkeletonTxRow } from '../components/dashboard/DashboardSkeletons'
import RefDashboardScroll from '../components/RefDashboardScroll'
import './dashboard.css'

/** Itens por requisição — menos DOM inicial; “Carregar mais” busca o restante. */
const TX_PAGE_SIZE = 80

export default function Transacoes() {
  const { privacyMode } = useTheme()
  const [usuario, setUsuario] = useState(() => readHorizonteUserPainelState())

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) setUsuario((prev) => ({ ...prev, ...u }))
  }, [])

  // States
  const { transacoes: cachedTx, fetchTransacoes: syncGlobalCache } = useTransactionCache()

  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  
  // Inicializa com o cache global para evitar "saltos" de tela (SWR)
  const [transacoes, setTransacoes] = useState(cachedTx || [])
  const [categorias, setCategorias] = useState([])
  const firstFetchDoneRef = useRef(false)
  
  // Só exibe Skeleton se o cache estiver vazio
  const [loading, setLoading] = useState(() => 
    horizonteUserProfileTemId(readHorizonteUserProfile()) && (!cachedTx || cachedTx.length === 0)
  )
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [recorrencias, setRecorrencias] = useState([])

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
      const res = await fetch(apiUrl('/api/categorias'), {
        headers: { 'x-user-id': session.id },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchRecorrencias = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await fetch(apiUrl('/api/recorrencias-mensais'), {
        headers: { 'x-user-id': session.id },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        setRecorrencias(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
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
      await syncRecorrenciasMensais(session.id)
      const res = await fetchWithRetry(apiUrl(`/api/transacoes?${buildTxQuery(0).toString()}`), {
        headers: { 'x-user-id': String(session.id).trim() },
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        setTransacoes(rows)
        setHasMore(rows.length === TX_PAGE_SIZE)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
      firstFetchDoneRef.current = true
    }
  }, [buildTxQuery])

  const loadMoreTransacoes = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return
    const session = readHorizonteUser()
    if (!session?.id) return
    setLoadingMore(true)
    try {
      const offset = transacoes.length
      const res = await fetchWithRetry(apiUrl(`/api/transacoes?${buildTxQuery(offset).toString()}`), {
        headers: { 'x-user-id': String(session.id).trim() },
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        const data = await res.json()
        const rows = Array.isArray(data) ? data : []
        setTransacoes((prev) => [...prev, ...rows])
        setHasMore(rows.length === TX_PAGE_SIZE)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }, [loading, refreshing, loadingMore, hasMore, transacoes.length, buildTxQuery])

  useEffect(() => {
    firstFetchDoneRef.current = false
  }, [usuario.id])

  useEffect(() => {
    const session = readHorizonteUser()
    if (session?.id) {
      fetchCategorias()
      fetchTransacoes()
      fetchRecorrencias()
    }
  }, [usuario.id, fetchCategorias, fetchTransacoes, fetchRecorrencias])

  const handleEncerrarRecorrencia = async (id) => {
    if (!window.confirm('Parar de repetir este lançamento todo dia 1?')) return
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await fetch(apiUrl(`/api/recorrencias-mensais/${id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': session.id },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) fetchRecorrencias()
    } catch (err) {
      console.error(err)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta transação?')) return
    const session = readHorizonteUser()
    if (!session?.id) return
    
    // Otimista
    setTransacoes(prev => prev.filter(t => t.id !== id))
    
    try {
      const res = await fetch(apiUrl(`/api/transacoes/${id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': session.id },
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) {
        syncGlobalCache({ silent: true }) // Atualiza o Dashboard também
      } else {
        // Se falhar, reverte buscando do servidor
        fetchTransacoes()
      }
    } catch (err) {
      console.error(err)
      fetchTransacoes()
    }
  }

  const formatCurrency = formatCurrencyBRL

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

  const whatsappContactUrl = 'https://wa.me/5547999895014'

  return (
    <>
    <div className="dashboard-container page-transacoes ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
        <section className="dashboard-hub__hero" aria-label="Transações e atalhos">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
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
              <a
                href={whatsappContactUrl || '#'}
                target={whatsappContactUrl ? '_blank' : undefined}
                rel={whatsappContactUrl ? 'noopener noreferrer' : undefined}
                tabIndex={whatsappContactUrl ? undefined : -1}
                className={`dashboard-hub__icon-btn dashboard-hub__icon-btn--wa ${!whatsappContactUrl ? 'dashboard-hub__icon-btn--disabled' : ''}`}
                aria-label="Abrir WhatsApp"
                title={
                  whatsappContactUrl
                    ? 'WhatsApp'
                    : 'Configure VITE_WHATSAPP_* no build ou WHATSAPP_CONTACT_* no servidor'
                }
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <section className="ref-bottom-grid ref-bottom-grid--single page-transacoes-panels" aria-label="Filtros e transações">
        <article
          className={`ref-panel page-transacoes-ref-filters ${filtrosAbertos ? '' : 'page-transacoes-ref-filters--collapsed'}`}
        >
          <div className="ref-panel__head page-transacoes-filters-head">
            <button
              type="button"
              className="page-transacoes-filters-toggle"
              id="transacoes-filtros-trigger"
              aria-expanded={filtrosAbertos}
              aria-controls="transacoes-filtros-fields"
              onClick={() => setFiltrosAbertos((open) => !open)}
            >
              <span className="page-transacoes-filters-toggle__lead">
                <span className="ref-panel__title" role="heading" aria-level={2}>
                  Filtros
                </span>
              </span>
              <svg
                className={`page-transacoes-filters-toggle__chevron ${filtrosAbertos ? 'page-transacoes-filters-toggle__chevron--open' : ''}`}
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button type="button" className="ref-panel__link ref-panel__link--button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
          <div
            id="transacoes-filtros-fields"
            className="page-transacoes-filters-body"
            role="region"
            aria-labelledby="transacoes-filtros-trigger"
            hidden={!filtrosAbertos}
          >
            <div className="transacoes-filter-grid page-transacoes-filter-grid">
              <div className="filter-group transacoes-filter-grid__search">
                <label htmlFor="tx-busca">Busca</label>
                <input
                  id="tx-busca"
                  type="text"
                  name="busca"
                  placeholder="Ex: Aluguel, Supermercado…"
                  className="filter-input"
                  value={filters.busca}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="tx-cat">Categoria</label>
                <select id="tx-cat" name="categoria_id" className="filter-input" value={filters.categoria_id} onChange={handleFilterChange}>
                  <option value="">Todas</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="tx-tipo">Tipo</label>
                <select id="tx-tipo" name="tipo" className="filter-input" value={filters.tipo} onChange={handleFilterChange}>
                  <option value="">Todos</option>
                  <option value="RECEITA">Receitas</option>
                  <option value="DESPESA">Despesas</option>
                </select>
              </div>
              <div className="filter-group transacoes-filter-grid__lancamentos">
                <label htmlFor="tx-lancamentos">Lançamentos</label>
                <select
                  id="tx-lancamentos"
                  name="lancamentos"
                  className="filter-input"
                  value={filters.lancamentos}
                  onChange={handleFilterChange}
                >
                  <option value="">Todos</option>
                  <option value="recorrentes">Recorrentes</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="tx-ini">Início</label>
                <input id="tx-ini" type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={handleFilterChange} />
              </div>
              <div className="filter-group">
                <label htmlFor="tx-fim">Fim</label>
                <input id="tx-fim" type="date" name="dataFim" className="filter-input" value={filters.dataFim} onChange={handleFilterChange} />
              </div>
            </div>
          </div>
        </article>

        {filtroRecorrentesAtivo && (
          <article
            className="ref-panel page-transacoes-ref-recorrencias page-transacoes-ref-recorrencias--filter"
            aria-label="Regras de repetição no dia 1"
          >
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
                          {formatCurrency(valorAbs)}
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
          className={`ref-panel ref-panel--transactions page-transacoes-ref-table${refreshing ? ' page-panel--refreshing' : ''}`}
        >
          <div className="ref-panel__head page-transacoes-tx-panel-head">
            <div>
              <h2 className="ref-panel__title">Transações</h2>
              {filtroRecorrentesAtivo ? (
                <p className="ref-panel__subtitle page-transacoes-tx-filter-hint">
                  Exibindo só lançamentos com parcelamento ou repetição mensal.
                </p>
              ) : null}
            </div>
          </div>
          <div className="ref-tx-list page-transacoes-tx-list" aria-busy={loading || refreshing}>
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
                  {filtroRecorrentesAtivo
                    ? 'Nenhum lançamento recorrente encontrado com os filtros atuais (período, busca ou categoria).'
                    : 'Nenhuma transação encontrada com os filtros atuais.'}
                </p>
                <button type="button" className="ref-empty-cta" onClick={clearFilters}>
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
              <div className="ref-tx-table-subgrid ref-tx-table-subgrid--actions">
                <div className="ref-tx-list-head">
                  <span className="ref-tx-list-head__icon" aria-hidden />
                  <span className="ref-tx-list-head__meta">Data</span>
                  <span className="ref-tx-list-head__cat">Categoria</span>
                  <span className="ref-tx-list-head__sub">Subcategoria</span>
                  <span className="ref-tx-list-head__rec" aria-hidden="true" />
                  <span className="ref-tx-list-head__val">Valor</span>
                  <span className="ref-tx-list-head__actions">Ações</span>
                </div>
                {transacoes.map((t) => {
                  const isRec = t.tipo === 'RECEITA'
                  const dt = new Date(t.data_transacao)
                  const dateLine = dt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                  const timeLine = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const isoDate = Number.isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10)
                  const catNome = (t.categorias?.nome && String(t.categorias.nome).trim()) || 'Sem categoria'
                  const subRaw = t.subcategorias
                  const subNome =
                    subRaw && typeof subRaw === 'object' && subRaw.nome && String(subRaw.nome).trim()
                      ? String(subRaw.nome).trim()
                      : (t.descricao && String(t.descricao).trim()) || '—'
                  const valorAbs = Math.abs(parseFloat(t.valor) || 0)
                  const mostraIconeRecorrente = Boolean(t.recorrencia_mensal_id) || Boolean(t.recorrente_index)
                  return (
                    <div key={t.id} className="ref-tx-row">
                      <div className="ref-tx-icon-cell">
                        <div className={`ref-tx-arrow-wrap ${isRec ? 'ref-tx-arrow-wrap--up' : 'ref-tx-arrow-wrap--down'}`} aria-hidden>
                          {isRec ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 19V5" />
                              <path d="m5 12 7-7 7 7" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14" />
                              <path d="m19 12-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="ref-tx-meta-cell">
                        <time className="ref-tx-date" dateTime={isoDate}>
                          {dateLine}
                        </time>
                        <span className="ref-tx-time-sub">{timeLine}</span>
                      </div>
                      <div className="ref-tx-cat-cell">
                        <span className="ref-tx-field-label">Categoria</span>
                        <p className="ref-tx-cat-text break-words">
                          {catNome}
                          {t.recorrente_index ? (
                            <span className="ref-tx-rec-badge">
                              {t.recorrente_index}/{t.recorrente_total}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="ref-tx-sub-cell">
                        <span className="ref-tx-field-label">Subcategoria</span>
                        <p className="ref-tx-sub-text break-words">{subNome}</p>
                      </div>
                      <div className="ref-tx-rec-cell">
                        {mostraIconeRecorrente ? (
                          <span
                            className="ref-tx-recorrencia-ico-wrap"
                            title="Lançamento recorrente"
                            aria-label="Lançamento recorrente"
                          >
                            <RecorrenciaArrowIcon size={14} className="ref-tx-recorrencia-ico" />
                          </span>
                        ) : null}
                      </div>
                      <div className="ref-tx-val-cell">
                        <span
                          className={`ref-tx-val ${isRec ? 'ref-tx-val--pos' : 'ref-tx-val--neg'} ${privacyMode ? 'privacy-blur' : ''}`}
                        >
                          <span className="ref-tx-val__amount">
                            {isRec ? '+' : '−'}
                            {formatCurrency(valorAbs)}
                          </span>
                        </span>
                      </div>
                      <div className="ref-tx-actions-cell">
                        <div className="transacoes-actions" role="group" aria-label="Ações da transação">
                          <button
                            type="button"
                            className="btn-edit"
                            onClick={() => {
                              setEditingTransaction(t)
                              setIsModalOpen(true)
                            }}
                            aria-label={`Editar transação ${t.descricao || 'sem descrição'}`}
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDelete(t.id)}
                            aria-label={`Excluir transação ${t.descricao || 'sem descrição'}`}
                            title="Excluir"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="page-transacoes-load-more">
                <p className="page-transacoes-tx-meta" aria-live="polite">
                  Mostrando {transacoes.length}{' '}
                  {transacoes.length === 1 ? 'transação' : 'transações'}
                  {hasMore ? ' · há mais com os filtros atuais' : ' · fim da lista'}
                </p>
                {hasMore ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={loadingMore || refreshing}
                    onClick={() => void loadMoreTransacoes()}
                  >
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                  </button>
                ) : null}
              </div>
              </>
            )}
          </div>
        </article>
        </section>
        </RefDashboardScroll>
        </div>
      </main>
      </div>
    </div>

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
    </>
  )
}
