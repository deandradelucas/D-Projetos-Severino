import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import { readHorizonteUser } from '../lib/horizonteSession'
import { getWhatsAppContactUrl } from '../lib/whatsappContactUrl'
import './dashboard.css'

const SkeletonTxRow = () => (
  <div className="ref-tx-row ref-tx-row--skeleton" aria-hidden>
    <div className="ref-tx-icon-cell">
      <span className="skeleton skeleton-pulse ref-tx-skel-icon" />
    </div>
    <div className="ref-tx-meta-cell">
      <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--meta" />
    </div>
    <div className="ref-tx-cat-cell">
      <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--cat" />
    </div>
    <div className="ref-tx-sub-cell">
      <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--sub" />
    </div>
    <div className="ref-tx-val-cell">
      <span className="skeleton skeleton-pulse ref-tx-skel-pill" />
    </div>
  </div>
)

export default function Transacoes() {
  const { privacyMode } = useTheme()
  const [usuario, setUsuario] = useState(() => readHorizonteUser() || { nome: 'Usuário', id: '' })

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) setUsuario((prev) => ({ ...prev, ...u }))
  }, [])

  // States
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transacoes, setTransacoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [recorrencias, setRecorrencias] = useState([])

  // Filters State
  const [filters, setFilters] = useState({
    busca: '',
    tipo: '',
    categoria_id: '',
    dataInicio: '',
    dataFim: ''
  })

  const fetchCategorias = useCallback(async () => {
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await fetch(apiUrl('/api/categorias'), {
        headers: { 'x-user-id': session.id },
      })
      if (res.status === 403) {
        window.location.replace('/pagamento?expirado=1')
        return
      }
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
      if (res.status === 403) {
        window.location.replace('/pagamento?expirado=1')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setRecorrencias(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    const session = readHorizonteUser()
    if (!session?.id) {
      setLoading(false)
      return
    }
    try {
      await syncRecorrenciasMensais(session.id)
      const params = new URLSearchParams()
      if (filters.busca) params.append('busca', filters.busca)
      if (filters.tipo) params.append('tipo', filters.tipo)
      if (filters.categoria_id) params.append('categoria_id', filters.categoria_id)
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.append('dataFim', filters.dataFim)
      params.append('limit', '500')

      const res = await fetch(apiUrl(`/api/transacoes?${params.toString()}`), {
        headers: { 'x-user-id': session.id },
      })
      if (res.status === 403) {
        window.location.replace('/pagamento?expirado=1')
        return
      }
      if (res.ok) {
        const data = await res.json()
        setTransacoes(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const session = readHorizonteUser()
    if (session?.id) {
      fetchCategorias()
      fetchTransacoes()
      fetchRecorrencias()
    }
  }, [fetchCategorias, fetchTransacoes, fetchRecorrencias])

  const handleEncerrarRecorrencia = async (id) => {
    if (!window.confirm('Parar de repetir este lançamento todo dia 1?')) return
    const session = readHorizonteUser()
    if (!session?.id) return
    try {
      const res = await fetch(apiUrl(`/api/recorrencias-mensais/${id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': session.id },
      })
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
    try {
      const res = await fetch(apiUrl(`/api/transacoes/${id}`), {
        method: 'DELETE',
        headers: { 'x-user-id': session.id },
      })
      if (res.ok) fetchTransacoes()
    } catch (err) {
      console.error(err)
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const clearFilters = () =>
    setFilters({ busca: '', tipo: '', categoria_id: '', dataInicio: '', dataFim: '' })

  const [whatsappContactUrl, setWhatsappContactUrl] = useState(() => getWhatsAppContactUrl())

  useEffect(() => {
    if (whatsappContactUrl) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/public/whatsapp-contact'), { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const url = typeof data?.url === 'string' ? data.url.trim() : ''
        if (url && !cancelled) setWhatsappContactUrl(url)
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [whatsappContactUrl])

  return (
    <>
    <div className="dashboard-container page-transacoes app-horizon-shell">
      <div className="app-horizon-inner">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner">
        <header className="ref-dashboard-header">
          <MobileMenuButton onClick={() => setMenuAberto(true)} />
          <div className="ref-dashboard-header__lead">
            <h1 className="ref-dashboard-greeting">
              <span className="ref-dashboard-greeting__name">Minhas transações</span>
            </h1>
          </div>
          <div className="ref-dashboard-header__actions">
            <button
              type="button"
              className="ref-dashboard-header__btn-tx"
              onClick={() => {
                setEditingTransaction(null)
                setIsModalOpen(true)
              }}
            >
              Nova transação
            </button>
            <a
              href={whatsappContactUrl || '#'}
              target={whatsappContactUrl ? '_blank' : undefined}
              rel={whatsappContactUrl ? 'noopener noreferrer' : undefined}
              tabIndex={whatsappContactUrl ? undefined : -1}
              className={`ref-dashboard-header__btn-wa ${!whatsappContactUrl ? 'ref-dashboard-header__btn-wa--disabled' : ''}`}
              aria-label="Abrir WhatsApp"
              title={
                whatsappContactUrl
                  ? 'WhatsApp'
                  : 'Configure VITE_WHATSAPP_* no build ou WHATSAPP_CONTACT_* no servidor'
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          </div>
        </header>

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
                <span className="ref-panel__subtitle page-transacoes-filters-toggle__sub">
                  Busca, categoria e período
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

        {recorrencias.length > 0 && (
          <article className="ref-panel page-transacoes-ref-recorrencias" aria-label="Lançamentos recorrentes">
            <div className="ref-panel__head page-transacoes-rec-head">
              <h2 className="ref-panel__title">Lançamentos recorrentes</h2>
              <span className="page-transacoes-rec-head__flag">Dia 1</span>
            </div>
            <ul className="page-transacoes-recorrencias-list">
              {recorrencias.map((r) => {
                const isRec = r.tipo === 'RECEITA'
                const label = (r.descricao && String(r.descricao).trim()) || 'Sem descrição'
                const valorAbs = Math.abs(parseFloat(r.valor) || 0)
                return (
                  <li key={r.id} className="page-transacoes-recorrencia-row">
                    <div className="page-transacoes-recorrencia-row__main">
                      <div className="page-transacoes-recorrencia-row__text">
                        <span className={`page-transacoes-recorrencia-row__tipo ${isRec ? 'page-transacoes-recorrencia-row__tipo--rec' : ''}`}>
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
          </article>
        )}

        <article className="ref-panel ref-panel--transactions page-transacoes-ref-table">
          <div className="ref-panel__head">
            <h2 className="ref-panel__title">Transações</h2>
          </div>
          <div className="ref-tx-list page-transacoes-tx-list">
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
                <p className="ref-empty">Nenhuma transação encontrada com os filtros atuais.</p>
                <button type="button" className="ref-empty-cta" onClick={clearFilters}>
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className="ref-tx-table-subgrid ref-tx-table-subgrid--actions">
                <div className="ref-tx-list-head">
                  <span className="ref-tx-list-head__icon" aria-hidden />
                  <span className="ref-tx-list-head__meta">Data</span>
                  <span className="ref-tx-list-head__cat">Categoria</span>
                  <span className="ref-tx-list-head__sub">Subcategoria</span>
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
                      <div className="ref-tx-val-cell">
                        <span
                          className={`ref-tx-val ${isRec ? 'ref-tx-val--pos' : 'ref-tx-val--neg'} ${privacyMode ? 'privacy-blur' : ''}`}
                        >
                          {isRec ? '+' : '−'}
                          {formatCurrency(valorAbs)}
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
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                          <button type="button" className="btn-delete" onClick={() => handleDelete(t.id)} title="Excluir">
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
            )}
          </div>
        </article>
        </section>
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
        })()
      }}
      usuarioId={readHorizonteUser()?.id || usuario.id}
      editingTransaction={editingTransaction}
    />
    </>
  )
}
