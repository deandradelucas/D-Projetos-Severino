import React, { useState, useEffect } from 'react'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'

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

  const ultimasReceitas = React.useMemo(
    () => transacoes.filter((t) => t.tipo === 'RECEITA').slice(0, 3),
    [transacoes]
  )
  const ultimasDespesas = React.useMemo(
    () => transacoes.filter((t) => t.tipo !== 'RECEITA').slice(0, 2),
    [transacoes]
  )
  const progressoContas = Math.max(8, Math.min(100, Math.round((transacoes.length / 16) * 100)))

  return (
    <div className="dashboard-container dashboard-page">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />


      {/* Main Content */}
      <main className="main-content relative z-10 exec-main-shell">
        <header className="exec-topbar">
          <div className="exec-topbar-left">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div className="exec-search-shell">
              <span className="exec-search-icon">⌕</span>
              <input className="exec-search-input" placeholder="Search" />
            </div>
          </div>
          <div className="exec-topbar-right">
            <button type="button" className="exec-icon-btn" aria-label="Conversas">◌</button>
            <button type="button" className="exec-icon-btn" aria-label="Notificações">◍</button>
          </div>
        </header>

        <h1 className="exec-page-title">Dashboard</h1>
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

        <section className="exec-grid-shell">
          <div className="exec-grid-left">
            <div className="exec-grid-topcards">
              <article className="exec-card exec-card--wallet">
                <p className="exec-card-label">Wallet</p>
                <p className={`exec-card-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(saldoTotal)}</p>
                <div className="exec-card-minirow">
                  <span className="exec-chip exec-chip--green">{formatCurrency(totalReceitas)}</span>
                  <span className="exec-chip exec-chip--rose">{formatCurrency(totalDespesas)}</span>
                </div>
              </article>
              <article className="exec-card exec-card--monthly">
                <div className="exec-card-head">
                  <p className="exec-card-title">Monthly earnings</p>
                  <span className="exec-card-sub">Income ↗</span>
                </div>
                <svg viewBox="0 0 240 90" className="exec-line-svg" aria-hidden>
                  <path d="M0 66 C20 46, 45 28, 72 45 C98 61, 122 70, 148 52 C172 35, 197 62, 240 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </article>
            </div>

            <article className="exec-card exec-card--table">
              <div className="exec-card-head">
                <p className="exec-card-title">Transactions</p>
                <button type="button" className="exec-add-btn" onClick={() => setIsModalOpen(true)}>+ Add</button>
              </div>
              {loading ? (
                <div className="skeleton-stagger">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : (
                <table className="exec-table">
                  <tbody>
                    {transacoes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="exec-table-empty">
                          Nenhuma transação registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      transacoes.slice(0, 9).map((t) => (
                        <tr key={t.id}>
                          <td className="exec-table-icon">↘</td>
                          <td className="exec-table-cat break-words">{t.categorias?.nome || 'Sem categoria'}</td>
                          <td className="exec-table-date">{new Date(t.data_transacao).toLocaleDateString('pt-BR')}</td>
                          <td className={`exec-table-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(t.valor)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </article>
          </div>

          <aside className="exec-grid-right">
            <article className="exec-card exec-card--payable">
              <p className="exec-card-title">Payable Accounts</p>
              <p className="exec-card-muted">Keep your accounts up to date to avoid issues.</p>
              <p className="exec-progress-label">{Math.round((progressoContas / 100) * 16)} OUT OF 16</p>
              <div className="exec-progress">
                <span style={{ width: `${progressoContas}%` }} />
              </div>
            </article>

            <article className="exec-card exec-card--list">
              <p className="exec-card-title">Receipts</p>
              <div className="exec-list">
                {(ultimasReceitas.length ? ultimasReceitas : transacoes.slice(0, 3)).map((t) => (
                  <div key={`r-${t.id}`} className="exec-list-item">
                    <span className="exec-list-icon">↗</span>
                    <div className="min-w-0">
                      <p className={`exec-list-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(t.valor)}</p>
                      <p className="exec-list-sub break-words">{t.categorias?.nome || 'Receita'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="exec-card exec-card--list">
              <p className="exec-card-title">Payables</p>
              <div className="exec-list">
                {(ultimasDespesas.length ? ultimasDespesas : transacoes.slice(0, 2)).map((t) => (
                  <div key={`d-${t.id}`} className="exec-list-item">
                    <span className="exec-list-icon">≋</span>
                    <div className="min-w-0">
                      <p className={`exec-list-value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(t.valor)}</p>
                      <p className="exec-list-sub break-words">{t.categorias?.nome || 'Despesa'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
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
