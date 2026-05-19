import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../context/ThemeContext'
import { useTransactionCache, TRANSACOES_REVALIDATED_EVENT } from '../context/transactionCacheStore'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
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
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
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
        headers: horizonteApiAuthHeaders(),
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
        headers: horizonteApiAuthHeaders(),
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
      void syncRecorrenciasMensais(session.id)
      const res = await fetchWithRetry(apiUrl(`/api/transacoes?${buildTxQuery(0).toString()}`), {
        headers: horizonteApiAuthHeaders(),
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

  // Mantém ref sempre atualizada sem precisar de dep no useEffect abaixo
  fetchTransacoesRef.current = fetchTransacoes

  const loadMoreTransacoes = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return
    const session = readHorizonteUser()
    if (!session?.id) return
    setLoadingMore(true)
    try {
      const offset = transacoes.length
      const res = await fetchWithRetry(apiUrl(`/api/transacoes?${buildTxQuery(offset).toString()}`), {
        headers: horizonteApiAuthHeaders(),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const res = await fetch(apiUrl(`/api/recorrencias-mensais/${id}`), {
        method: 'DELETE',
        headers: horizonteApiAuthHeaders(),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (res.ok) fetchRecorrencias()
    } catch (err) {
      console.error(err)
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
      const res = await fetch(apiUrl(`/api/transacoes/${id}`), {
        method: 'DELETE',
        headers: horizonteApiAuthHeaders(),
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

  const handleDelete = (transacao) => {
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

  const whatsappContactUrl = useMemo(() => getWhatsappContactUrl(), [])

  return (
    <>
    <div className="dashboard-container dashboard-page page-transacoes ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
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
          className={`ref-panel ref-panel--transactions dashboard-hub__tx-panel page-transacoes-ref-table${refreshing ? ' page-panel--refreshing' : ''}`}
        >
          <div className="ref-panel__head page-transacoes-tx-panel-head">
            <div className="page-transacoes-tx-panel-head__titles">
              <h2 className="ref-panel__title">Transações</h2>
              {filtroRecorrentesAtivo ? (
                <p className="ref-panel__subtitle page-transacoes-tx-filter-hint">
                  Exibindo só lançamentos com parcelamento ou repetição mensal.
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
                {transacoes.map((t) => (
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
                ))}
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
