import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'

export default function Dashboard() {
  const [usuario] = useState(() => {
    const saved = localStorage.getItem('horizonte_user')
    if (saved) {
      try {
        return JSON.parse(saved) || { nome: 'Usuário', email: '' }
      } catch (e) {
        console.error('Error parsing user', e)
      }
    }
    return { nome: 'Usuário', email: '' }
  })
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchTransacoes = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transacoes', {
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
  }, [usuario.id])

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return

    try {
      const res = await fetch(`/api/transacoes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': usuario.id }
      })
      if (res.ok) {
        fetchTransacoes()
      } else {
        alert('Erro ao excluir transação.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro inesperado ao excluir transação.')
    }
  }

  useEffect(() => {
    if (usuario.id) {
      fetchTransacoes()
    }
  }, [usuario.id, fetchTransacoes])

  const { totalReceitas, totalDespesas, saldoTotal } = React.useMemo(() => {
    return transacoes.reduce((acc, t) => {
      const valor = parseFloat(t.valor) || 0
      if (t.tipo === 'RECEITA') {
        acc.totalReceitas += valor
        acc.saldoTotal += valor
      } else {
        acc.totalDespesas += valor
        acc.saldoTotal -= valor
      }
      return acc
    }, { totalReceitas: 0, totalDespesas: 0, saldoTotal: 0 })
  }, [transacoes])

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />


      {/* Main Content */}
      <main className="main-content relative z-10">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div>
              <h1 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Olá, {usuario.nome} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Aqui está o resumo financeiro da sua conta.
              </p>
            </div>
          </div>
          
          <div className="user-profile">
            <div style={{ textAlign: 'right', display: 'none' }} className="sm:block">
              <div style={{ fontWeight: 500, fontSize: '14px' }}>{usuario.nome}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{usuario.email || 'usuário autenticado'}</div>
            </div>
            <div className="avatar">{usuario.nome.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-header">
              <span>Saldo Total</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--accent)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <div className="kpi-value">{formatCurrency(saldoTotal)}</div>
            <div className="trend-up" style={{ color: 'var(--text-secondary)', opacity: transacoes.length > 0 ? 1 : 0.5 }}>
              {transacoes.length > 0 ? `${transacoes.length} transações registradas` : 'Sem dados no período'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Receitas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{formatCurrency(totalReceitas)}</div>
            <div className="trend-up" style={{ color: 'var(--text-secondary)', opacity: totalReceitas > 0 ? 1 : 0.5 }}>
              {totalReceitas > 0 ? 'Rendimento positivo' : 'Sem receitas registradas'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span>Despesas</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--danger)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
              </svg>
            </div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>- {formatCurrency(totalDespesas)}</div>
            <div className="trend-down" style={{ color: 'var(--text-secondary)', opacity: totalDespesas > 0 ? 1 : 0.5 }}>
              {totalDespesas > 0 ? 'Gastos acumulados' : 'Sem despesas registradas'}
            </div>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <section className="content-section">
          <div className="section-header">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Transações Recentes</h2>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Nova Transação</button>
          </div>

          <div style={{ overflowX: 'auto', padding: '10px 0' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</p>
            ) : transacoes.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma transação encontrada para este período.</p>
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
                      <td>{t.descricao}</td>
                      <td>
                        {t.categorias?.nome}
                        {t.subcategorias?.nome ? ` - ${t.subcategorias.nome}` : ''}
                      </td>
                      <td className={t.tipo === 'RECEITA' ? 'val-positive' : 'val-negative'}>
                        {t.tipo === 'RECEITA' ? '+' : '-'} R$ {parseFloat(t.valor).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge badge-${t.status?.toLowerCase() || 'efetivada'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-delete" onClick={() => handleDelete(t.id)} title="Excluir Transação">
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
