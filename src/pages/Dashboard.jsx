import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'

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
  const [usuario, setUsuario] = useState(() => readHorizonteUser() || { nome: 'Usuário', email: '', id: '' })
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const chartRef = useRef(null)

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) setUsuario((prev) => ({ ...prev, ...u }))
  }, [])

  const fetchTransacoes = React.useCallback(async () => {
    setLoading(true)
    setFetchError('')
    const session = readHorizonteUser()
    if (!session?.id) {
      setLoading(false)
      setTransacoes([])
      setFetchError('Sessão inválida. Faça login novamente.')
      return
    }
    try {
      await new Promise((r) => setTimeout(r, 600))

      const res = await fetch(apiUrl('/api/transacoes'), {
        headers: { 'x-user-id': String(session.id).trim() },
        cache: 'no-store',
      })

      if (res.status === 403) {
        window.location.replace('/pagamento?expirado=1')
        return
      }

      if (res.ok) {
        const data = await res.json()
        setTransacoes(Array.isArray(data) ? data : [])
        return
      }

      const errBody = await res.json().catch(() => ({}))
      setTransacoes([])
      setFetchError(errBody.message || `Não foi possível carregar transações (${res.status}).`)
    } catch (err) {
      console.error(err)
      setTransacoes([])
      setFetchError('Sem conexão com a API. Verifique a internet e se VITE_API_URL aponta para o servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const u = readHorizonteUser()
    if (u?.id) {
      fetchTransacoes()
    } else {
      setLoading(false)
      setFetchError('Faça login para ver suas transações.')
    }
  }, [fetchTransacoes])

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
    <div className="dashboard-container dashboard-page">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />


      {/* Main Content */}
      <main className="main-content relative z-10">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div className="dashboard-greeting">
              <h1 className="responsive-h1 dashboard-greeting-title">
                Olá, {usuario.nome}!
              </h1>
              <p className="responsive-p dashboard-greeting-sub">
                Resumo geral deste mês
              </p>
            </div>
          </div>
        </header>
        {fetchError && (
          <div
            className="content-section"
            style={{
              marginBottom: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
            role="alert"
          >
            {fetchError}
          </div>
        )}

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
            <section className="content-section dashboard-transactions-card" style={{ marginBottom: 0 }}>
              <div className="section-header dashboard-section-header">
                <h1 className="responsive-h1 dashboard-section-title">Minhas Transações</h1>
                <button type="button" className="btn-primary btn-primary-dashboard" onClick={() => setIsModalOpen(true)}>+ Transação</button>
              </div>

              <div className="transactions-table-wrap">
                {loading ? (
                  <div className="skeleton-stagger">
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : (
                  <table className="data-table dashboard-overview-table">
                    <thead>
                      <tr>
                        <th className="dashboard-overview-th-date">Data</th>
                        <th className="dashboard-overview-th-cat">Categoria</th>
                        <th className="dashboard-overview-th-val" style={{ textAlign: 'right' }}>
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transacoes.slice(0, 8).map(t => (
                        <tr key={t.id}>
                          <td className="dashboard-overview-td-date">
                            <div className="dashboard-tx-date-stack">
                              <div className="dashboard-tx-date-day">
                                {new Date(t.data_transacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </div>
                              <div className="dashboard-tx-date-time">
                                {new Date(t.data_transacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </td>
                          <td className="dashboard-overview-td-cat">
                            <div className="dashboard-tx-cat-row">
                              <div
                                className="dashboard-tx-dot"
                                style={{
                                  background: t.categorias?.cor || 'var(--accent)',
                                  boxShadow: `0 0 8px ${t.categorias?.cor || 'var(--accent)'}40`,
                                }}
                              />
                              <div className="dashboard-tx-cat-text">
                                <div className="dashboard-tx-cat-name">
                                  {t.categorias?.nome || 'Sem categoria'}
                                  {t.recorrente_index && (
                                    <span className="dashboard-tx-recorrente-badge">
                                      {t.recorrente_index}/{t.recorrente_total}
                                    </span>
                                  )}
                                </div>
                                <div className="dashboard-tx-cat-sub">{t.subcategorias?.nome || 'Geral'}</div>
                              </div>
                            </div>
                          </td>
                          <td
                            className={`dashboard-overview-td-val ${t.tipo === 'RECEITA' ? 'val-positive' : 'val-negative'} ${privacyMode ? 'privacy-blur' : ''}`}
                            style={{ fontWeight: 700, textAlign: 'right', fontSize: '15px' }}
                          >
                            <span className="dashboard-tx-val-sign">{t.tipo === 'RECEITA' ? '+' : '-'}</span>
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
        usuarioId={readHorizonteUser()?.id || usuario.id}
      />
    </div>
  )
}
