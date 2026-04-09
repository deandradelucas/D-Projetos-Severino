import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import TransactionModal from '../components/TransactionModal'
import GlobalSkeleton from '../components/GlobalSkeleton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
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

  return (
    <div className="dashboard-container page-transacoes">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10">
        <header className="top-header transacoes-page-header">
           <div className="transacoes-page-header__titles">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div>
              <h1 className="responsive-h1 transacoes-page-header__h1">Minhas Transações</h1>
              <p className="transacoes-page-header__sub">Lista completa com filtros e totais do recorte</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary btn-primary-dashboard"
            onClick={() => {
              setEditingTransaction(null)
              setIsModalOpen(true)
            }}
          >
            + Transação
          </button>
        </header>

        {/* Summary KPIs */}
        <div className="kpi-grid transacoes-kpi-strip">
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Receitas Filtradas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--success)' }}>{formatCurrency(summary.receitas)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Despesas Filtradas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--danger)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
              </svg>
            </div>
            <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--danger)' }}>- {formatCurrency(summary.despesas)}</div>
          </div>

          <div className="kpi-card accent">
            <div className="kpi-header">
              <span>Balanço do Filtro</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--accent)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <div
              className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`}
              style={{ color: summary.saldo >= 0 ? 'var(--transacoes-balance-pos)' : 'var(--danger)' }}
            >
              {formatCurrency(summary.saldo)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <section className="transacoes-filter-shell" aria-label="Filtros de transações">
          <div className="transacoes-filter-shell__head">
            <div>
              <h2 className="transacoes-filter-shell__title">Filtros</h2>
              <p className="transacoes-filter-shell__hint">Busca, categoria e período</p>
            </div>
            <button type="button" className="transacoes-btn-clear" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
          <div className="transacoes-filter-grid">
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
        </section>

        {/* Table Section */}
        <section className="content-section transacoes-table-card">
          <div className="transacoes-table-scroll">
            {loading ? (
              <GlobalSkeleton variant="table" rows={7} />
            ) : transacoes.length === 0 ? (
              <div className="transacoes-empty">
                <p className="transacoes-empty__text">Nenhuma transação encontrada com os filtros atuais.</p>
                <button type="button" className="transacoes-empty__action" onClick={clearFilters}>
                  Limpar todos os filtros
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
        </section>
      </main>

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
    </div>
  )
}
