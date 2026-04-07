import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'

const SkeletonCard = () => (
  <div className="skeleton skeleton-card">
    <div className="skeleton-card-header">
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-icon"></div>
    </div>
    <div className="skeleton skeleton-value"></div>
    <div className="skeleton skeleton-badge"></div>
  </div>
)

const SkeletonRow = () => (
  <div className="skeleton skeleton-row">
    <div className="skeleton-row-date">
      <span className="skeleton skeleton-pulse"></span>
      <span className="skeleton skeleton-pulse" style={{ width: '30px', height: '8px' }}></span>
    </div>
    <div className="skeleton-row-content">
      <span className="skeleton skeleton-pulse"></span>
      <span className="skeleton skeleton-pulse" style={{ width: '60%', height: '10px' }}></span>
    </div>
    <div className="skeleton skeleton-row-value"></div>
  </div>
)

const SkeletonChart = ({ ref: externalRef }) => (
  <div className="skeleton skeleton-chart" ref={externalRef}>
    <div className="skeleton-chart-header">
      <div className="skeleton skeleton-chart-title"></div>
      <div className="skeleton-chart-legend">
        <span className="skeleton skeleton-pulse"></span>
        <span className="skeleton skeleton-pulse"></span>
      </div>
    </div>
    <div className="skeleton skeleton-chart-area">
      <div className="skeleton-chart-bars">
        {[65, 45, 80, 55, 90, 70, 85].map((h, i) => (
          <div key={i} className="skeleton skeleton-bar" style={{ 
            height: `${h}%`, 
            animationDelay: `${i * 100}ms` 
          }}></div>
        ))}
      </div>
    </div>
  </div>
)





const COLORS = [] // Não mais usado no dashboard

export default function Dashboard() {
  const { privacyMode } = useTheme()
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
  const [loading, setLoading] = useState(true)
  const chartRef = useRef(null)

  const fetchTransacoes = React.useCallback(async () => {
    setLoading(true)
    try {
      // Pequeno delay para mostrar o skeleton de forma elegante
      await new Promise(r => setTimeout(r, 600))
      
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

  useEffect(() => {
    if (usuario.id) {
      fetchTransacoes()
    }
  }, [usuario.id, fetchTransacoes])

  useEffect(() => {
    if (!chartRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [])

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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </button>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Olá, {usuario.nome}!
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                Resumo geral deste mês
              </p>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="kpi-grid skeleton-stagger">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="kpi-card accent">
                <div className="kpi-header">
                  <span>Saldo Total</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                </div>
                <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(saldoTotal)}</div>
                <div className="trend-up" style={{ color: 'var(--text-secondary)' }}>
                  {transacoes.length} transações registradas
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span>Receitas</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--success)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
                <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--success)' }}>{formatCurrency(totalReceitas)}</div>
                <div className="trend-up" style={{ color: 'var(--text-secondary)' }}>
                  Ganhos acumulados
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span>Despesas</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', color: 'var(--danger)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
                  </svg>
                </div>
                <div className={`kpi-value ${privacyMode ? 'privacy-blur' : ''}`} style={{ color: 'var(--danger)' }}>- {formatCurrency(totalDespesas)}</div>
                <div className="trend-down" style={{ color: 'var(--text-secondary)' }}>
                  Gastos registrados
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main Grid: Charts & Table */}
        {!loading && transacoes.length === 0 ? (
          <div className="empty-state-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4Z"/></svg>
            <h2 className="empty-state-title">Nenhuma transação ainda</h2>
            <p className="empty-state-text">Comece a organizar suas finanças agora mesmo adicionando sua primeira receita ou despesa.</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Primeira Transação</button>
          </div>
        ) : (
          <div className="dashboard-grid-main">
            {/* Table Section */}
            <section className="content-section" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Últimas Atividades</h2>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Nova</button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                {loading ? (
                  <div className="skeleton-stagger">
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Categoria</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transacoes.slice(0, 8).map(t => (
                        <tr key={t.id}>
                           <td style={{ minWidth: '100px', padding: '16px 20px' }}>
                             <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                               {new Date(t.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                             </div>
                             <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                               {new Date(t.data_transacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                             </div>
                           </td>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                background: t.categorias?.cor || 'var(--accent)',
                                boxShadow: `0 0 8px ${t.categorias?.cor || 'var(--accent)'}40`
                              }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                  {t.categorias?.nome || 'Sem categoria'}
                                  {t.recorrente_index && (
                                    <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--accent)', fontWeight: 700, background: 'var(--accent)20', padding: '1px 5px', borderRadius: '4px' }}>
                                      {t.recorrente_index}/{t.recorrente_total}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {t.subcategorias?.nome || 'Geral'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={`${t.tipo === 'RECEITA' ? 'val-positive' : 'val-negative'} ${privacyMode ? 'privacy-blur' : ''}`} style={{ fontWeight: 700, textAlign: 'right', fontSize: '15px', padding: '16px 20px' }}>
                            <span style={{ opacity: 0.8, fontSize: '12px', marginRight: '4px' }}>{t.tipo === 'RECEITA' ? '+' : '-'}</span> 
                            {formatCurrency(t.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>


          </div>
        ) }
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
