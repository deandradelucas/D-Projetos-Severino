import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import TransactionModal from '../components/TransactionModal'
import './dashboard.css'

export default function Transacoes() {
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    if (saved) {
      try {
        return JSON.parse(saved) || { nome: 'Usuário', id: '' }
      } catch (e) { console.error(e) }
    }
    return { nome: 'Usuário', id: '' }
  })

  // States
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters State
  const [filters, setFilters] = useState({
    busca: '',
    tipo: '',
    status: '',
    categoria_id: '',
    dataInicio: '',
    dataFim: ''
  })

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch('/api/categorias', {
        headers: { 'x-user-id': usuario.id }
      })
      if (res.ok) {
        const data = await res.json()
        setCategorias(data || [])
      }
    } catch (err) { console.error(err) }
  }, [usuario.id])

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.busca) params.append('busca', filters.busca)
      if (filters.tipo) params.append('tipo', filters.tipo)
      if (filters.status) params.append('status', filters.status)
      if (filters.categoria_id) params.append('categoria_id', filters.categoria_id)
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.append('dataFim', filters.dataFim)
      params.append('limit', '500')

      const res = await fetch(`/api/transacoes?${params.toString()}`, {
        headers: { 'x-user-id': usuario.id }
      })
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [usuario.id, filters])

  useEffect(() => {
    if (usuario.id) {
      fetchCategorias()
      fetchTransacoes()
    }
  }, [usuario.id, fetchCategorias, fetchTransacoes])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta transação?')) return
    try {
      const res = await fetch(`/api/transacoes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': usuario.id }
      })
      if (res.ok) fetchTransacoes()
    } catch (err) { console.error(err) }
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

  return (
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10">
        <header className="top-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Minhas Transações</h1>
          </div>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Nova Transação</button>
        </header>

        {/* Summary Banner */}
        <div className="summary-banner">
          <div className="summary-item">
            <span className="summary-label">Receitas</span>
            <span className="summary-value income">{formatCurrency(summary.receitas)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Despesas</span>
            <span className="summary-value expense">-{formatCurrency(summary.despesas)}</span>
          </div>
          <div className="summary-item" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '32px' }}>
            <span className="summary-label">Balanço do Filtro</span>
            <span className="summary-value" style={{ color: summary.saldo >= 0 ? '#4ade80' : '#f87171' }}>
              {formatCurrency(summary.saldo)}
            </span>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="filter-bar">
          <div className="filter-group" style={{ flex: '2', minWidth: '200px' }}>
            <label>Busca</label>
            <input 
              type="text" 
              name="busca" 
              placeholder="Ex: Aluguel, Supermercado..." 
              className="filter-input" 
              value={filters.busca}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>Categoria</label>
            <select name="categoria_id" className="filter-input" value={filters.categoria_id} onChange={handleFilterChange}>
              <option value="">Todas</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Tipo</label>
            <select name="tipo" className="filter-input" value={filters.tipo} onChange={handleFilterChange}>
              <option value="">Todos</option>
              <option value="RECEITA">Receitas</option>
              <option value="DESPESA">Despesas</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select name="status" className="filter-input" value={filters.status} onChange={handleFilterChange}>
              <option value="">Todos</option>
              <option value="EFETIVADA">Efetivadas</option>
              <option value="PENDENTE">Pendentes</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Início</label>
            <input type="date" name="dataInicio" className="filter-input" value={filters.dataInicio} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label>Fim</label>
            <input type="date" name="dataFim" className="filter-input" value={filters.dataFim} onChange={handleFilterChange} />
          </div>
        </div>

        {/* Table Section */}
        <section className="content-section">
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Filtrando transações...</p>
            ) : transacoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Nenhuma transação encontrada com os filtros atuais.</p>
                <button 
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setFilters({ busca: '', tipo: '', status: '', categoria_id: '', dataInicio: '', dataFim: '' })}
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.data_transacao).toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 500 }}>{t.descricao}</td>
                      <td>
                        <span style={{ fontSize: '13px', opacity: 0.8 }}>
                          {t.categorias?.nome}
                          {t.subcategorias?.nome ? ` • ${t.subcategorias.nome}` : ''}
                        </span>
                      </td>
                      <td className={t.tipo === 'RECEITA' ? 'val-positive' : 'val-negative'}>
                        {t.tipo === 'RECEITA' ? '+' : '-'} {formatCurrency(t.valor)}
                      </td>
                      <td>
                        <span className={`badge badge-${t.status?.toLowerCase() || 'efetivada'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-delete" onClick={() => handleDelete(t.id)} title="Excluir">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
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
        onClose={() => setIsModalOpen(false)}
        onSave={fetchTransacoes}
        usuarioId={usuario.id}
      />
    </div>
  )
}
