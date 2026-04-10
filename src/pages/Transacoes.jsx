import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import GlobalSkeleton from '../components/GlobalSkeleton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { getWhatsAppContactUrl } from '../lib/whatsappContactUrl'
import './dashboard.css'

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

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    const session = readHorizonteUser()
    if (!session?.id) {
      setLoading(false)
      return
    }
    try {
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
    }
  }, [fetchCategorias, fetchTransacoes])

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

  const summary = useMemo(() => {
    return transacoes.reduce((acc, t) => {
      const val = parseFloat(t.valor) || 0
      if (t.tipo === 'RECEITA') {
        acc.receitas += val
        acc.saldo += val
      } else {
        acc.despesas += val
        acc.saldo -= val
      }
      return acc
    }, { receitas: 0, despesas: 0, saldo: 0 })
  }, [transacoes])

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
            <p className="page-transacoes-header__sub">Lista completa com filtros e totais do recorte</p>
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

        <section className="ref-kpi-row" aria-label="Resumo do filtro">
          <article className="ref-kpi-card ref-kpi-card--balance ref-kpi-card--hero">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
                <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Saldo do filtro</p>
              <p
                className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}
                style={summary.saldo < 0 ? { color: '#dc2626' } : undefined}
              >
                {formatCurrency(summary.saldo)}
              </p>
            </div>
          </article>
          <article className="ref-kpi-card ref-kpi-card--expense">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Saída</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(summary.despesas)}</p>
            </div>
          </article>
          <article className="ref-kpi-card ref-kpi-card--income">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Entrada</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(summary.receitas)}</p>
            </div>
          </article>
        </section>

        <section className="ref-bottom-grid ref-bottom-grid--single page-transacoes-panels" aria-label="Filtros e transações">
        <article className="ref-panel page-transacoes-ref-filters">
          <div className="ref-panel__head">
            <div>
              <h2 className="ref-panel__title">Filtros</h2>
              <p className="ref-panel__subtitle">Busca, categoria e período</p>
            </div>
            <button type="button" className="ref-panel__link ref-panel__link--button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
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
        </article>

        <article className="ref-panel page-transacoes-ref-table">
          <div className="ref-panel__head">
            <h2 className="ref-panel__title">Transações</h2>
          </div>
          <div className="transacoes-table-scroll page-transacoes-table-body">
            {loading ? (
              <GlobalSkeleton variant="table" rows={7} />
            ) : transacoes.length === 0 ? (
              <div className="ref-empty-state">
                <p className="ref-empty">Nenhuma transação encontrada com os filtros atuais.</p>
                <button type="button" className="ref-empty-cta" onClick={clearFilters}>
                  Limpar filtros
                </button>
              </div>
            ) : (
              <table className="data-table transacoes-data-table">
                <thead>
                  <tr>
                     <th>Data</th>
                     <th>Categoria</th>
                     <th>Valor</th>
                     <th className="transacoes-col-actions">Ações</th>
                   </tr>
                </thead>
                <tbody>
                  {transacoes.map(t => (
                    <tr key={t.id}>
                       <td className="transacoes-cell-date">
                         <div className="transacoes-cell-date__day">
                           {new Date(t.data_transacao).toLocaleDateString('pt-BR')}
                         </div>
                         <div className="transacoes-cell-date__time">
                           {new Date(t.data_transacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                         </div>
                       </td>
                       <td>
                         <div className="transacoes-cell-cat-title">
                           {t.categorias?.nome || 'Sem categoria'}
                           {t.recorrente_index && (
                             <span className="transacoes-rec-badge">
                               {t.recorrente_index}/{t.recorrente_total}
                             </span>
                           )}
                         </div>
                         <div className="transacoes-cell-cat-sub">
                           {t.subcategorias?.nome || t.descricao || ''}
                         </div>
                       </td>
                      <td className={t.tipo === 'RECEITA' ? 'val-positive' : 'val-negative'}>
                         <span className={`transacoes-cell-val ${privacyMode ? 'privacy-blur' : ''}`}>
                           {t.tipo === 'RECEITA' ? (
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transacoes-val-ico transacoes-val-ico--up"><path d="m18 15-6-6-6 6"/></svg>
                           ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transacoes-val-ico transacoes-val-ico--down"><path d="m6 9 6 6 6-6"/></svg>
                           )}
                           {formatCurrency(t.valor)}
                         </span>
                      </td>
                      <td className="transacoes-col-actions">
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      onSave={fetchTransacoes}
      usuarioId={readHorizonteUser()?.id || usuario.id}
      editingTransaction={editingTransaction}
    />
    </>
  )
}
