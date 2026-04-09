import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'

/** Linha do gráfico: despesas por dia no mês corrente */
function buildSpendLinePath(transacoes) {
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const daily = Array.from({ length: daysInMonth }, () => 0)

  transacoes.forEach((t) => {
    const tipo = String(t.tipo || '').toUpperCase()
    if (tipo !== 'DESPESA') return
    const d = new Date(t.data_transacao)
    if (Number.isNaN(d.getTime())) return
    if (d.getFullYear() !== y || d.getMonth() !== mo) return
    const dayIdx = d.getDate() - 1
    if (dayIdx >= 0 && dayIdx < daysInMonth) {
      daily[dayIdx] += parseFloat(t.valor) || 0
    }
  })

  const w = 320
  const h = 100
  const pad = 8
  const max = Math.max(...daily, 1)
  const step = daysInMonth > 1 ? (w - pad * 2) / (daysInMonth - 1) : 0

  const points = daily.map((v, i) => {
    const x = pad + i * step
    const yn = h - pad - (v / max) * (h - pad * 2)
    return [x, yn]
  })

  if (points.length === 0) return { d: '', w, h }

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`
  }
  return { d, w, h }
}

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

export default function Dashboard() {
  const { privacyMode } = useTheme()
  const [usuario, setUsuario] = useState(() => readHorizonteUser() || { nome: 'Usuário', email: '', id: '' })
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) {
      queueMicrotask(() => setUsuario((prev) => ({ ...prev, ...u })))
    }
  }, [])

  const fetchTransacoes = React.useCallback(async () => {
    setLoading(true)
    setFetchError('')
    const session = readHorizonteUser()
    if (!session?.id) {
      setTransacoes([])
      setFetchError('Sessão inválida. Faça login novamente.')
      setLoading(false)
      return
    }
    try {
      await new Promise((r) => setTimeout(r, 400))

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
      queueMicrotask(() => {
        void fetchTransacoes()
      })
    } else {
      queueMicrotask(() => setFetchError('Faça login para ver suas transações.'))
    }
  }, [fetchTransacoes])

  const { totalReceitas, totalDespesas, saldoTotal } = useMemo(() => {
    return transacoes.reduce(
      (acc, t) => {
        const valor = parseFloat(t.valor) || 0
        if (t.tipo === 'RECEITA') {
          acc.totalReceitas += valor
          acc.saldoTotal += valor
        } else {
          acc.totalDespesas += valor
          acc.saldoTotal -= valor
        }
        return acc
      },
      { totalReceitas: 0, totalDespesas: 0, saldoTotal: 0 }
    )
  }, [transacoes])

  const fluxoLiquido = totalReceitas - totalDespesas

  const mesLabel = useMemo(
    () => new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    []
  )

  const linePath = useMemo(() => buildSpendLinePath(transacoes), [transacoes])

  const receitasDestaque = useMemo(
    () => transacoes.filter((t) => t.tipo === 'RECEITA').slice(0, 4),
    [transacoes]
  )

  const txRecentes = useMemo(() => transacoes.slice(0, 8), [transacoes])

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <div className="dashboard-container dashboard-page ref-dashboard">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-top">
          <div className="ref-dashboard-top__left">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
          </div>
          <div className="ref-ai-banner" role="region" aria-label="Assistente">
            <div className="ref-ai-banner__lead">
              <p className="ref-ai-banner__text">Horizonte — Agente de inteligência financeira</p>
              <div className="ref-ai-banner__metrics">
                <span className="ref-ai-banner__metric">
                  Gasto{' '}
                  <strong className={privacyMode ? 'privacy-blur' : ''}>{formatCurrency(totalDespesas)}</strong>
                </span>
                <span className="ref-ai-banner__metric">
                  Fluxo{' '}
                  <strong className={privacyMode ? 'privacy-blur' : ''}>{formatCurrency(fluxoLiquido)}</strong>
                </span>
              </div>
            </div>
            <div className="ref-ai-banner__actions">
              <button type="button" className="ref-ai-banner__falar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Falar
              </button>
              <button type="button" className="ref-ai-banner__perguntar">
                Perguntar
              </button>
            </div>
          </div>
          <div className="ref-dashboard-top__icons">
            <button type="button" className="ref-icon-circle" aria-label="Conversas">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button type="button" className="ref-icon-circle" aria-label="Notificações">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          </div>
        </div>

        <h1 className="ref-page-title">Dashboard</h1>

        {fetchError && (
          <div className="ref-alert" role="alert">
            {fetchError}
          </div>
        )}

        <section className="ref-kpi-row" aria-label="Resumo financeiro">
          <article className="ref-kpi-card ref-kpi-card--balance">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Saldo em Conta</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(saldoTotal)}</p>
              <p className="ref-kpi-card__hint">Disponível agora</p>
            </div>
          </article>
          <article className="ref-kpi-card ref-kpi-card--expense">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7 L7 11 L11 5 L15 13 L19 8 L21 6" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Saída</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalDespesas)}</p>
              <p className="ref-kpi-card__hint">Despesas do período</p>
            </div>
          </article>
          <article className="ref-kpi-card ref-kpi-card--income">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 15 L7 9 L11 15 L15 7 L19 12 L21 14" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Entrada</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalReceitas)}</p>
              <p className="ref-kpi-card__hint">Receitas do período</p>
            </div>
          </article>
          <article className="ref-kpi-card ref-kpi-card--invest">
            <div className="ref-kpi-card__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 5c-1.5 0-2.8 1.1-3 2.5-.2-1.4-1.5-2.5-3-2.5-1.3 0-2.4.8-3 2-.6-1.2-1.7-2-3-2C5.6 5 4 6.7 4 9c0 3.4 4 6.9 7 10 3-3.1 7-6.6 7-10 0-2.3-1.6-4-4-4z" />
                <path d="M12 18c-1-1.2-2.3-2.5-3.5-4" />
              </svg>
            </div>
            <div className="ref-kpi-card__body">
              <p className="ref-kpi-card__label">Investimentos</p>
              <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(0)}</p>
              <p className="ref-kpi-card__hint">Em breve no app</p>
            </div>
          </article>
        </section>

        <section className="ref-bottom-grid">
          <article className="ref-panel ref-panel--transactions">
            <div className="ref-panel__head">
              <h2 className="ref-panel__title">Transações</h2>
              <Link to="/transacoes" className="ref-panel__link">
                Ver todas
              </Link>
            </div>
            <div className="ref-tx-list">
              {loading ? (
                <div className="skeleton-stagger">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : txRecentes.length === 0 ? (
                <p className="ref-empty">Nenhuma transação ainda.</p>
              ) : (
                txRecentes.map((t) => {
                  const isRec = t.tipo === 'RECEITA'
                  const dt = new Date(t.data_transacao)
                  const line1 = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  const line2 = String(dt.getFullYear())
                  return (
                    <div key={t.id} className="ref-tx-row">
                      <span className={`ref-tx-arrow ${isRec ? 'ref-tx-arrow--up' : 'ref-tx-arrow--down'}`} aria-hidden>
                        {isRec ? '↗' : '↘'}
                      </span>
                      <div className="ref-tx-mid min-w-0">
                        <p className="ref-tx-name break-words">{t.categorias?.nome || 'Sem categoria'}</p>
                        <p className="ref-tx-date">
                          {line1}
                          <br />
                          {line2}
                        </p>
                      </div>
                      <span
                        className={`ref-tx-val ${isRec ? 'ref-tx-val--pos' : 'ref-tx-val--neg'} ${privacyMode ? 'privacy-blur' : ''}`}
                      >
                        {isRec ? '+' : '−'}
                        {formatCurrency(Math.abs(parseFloat(t.valor) || 0))}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </article>

          <article className="ref-panel ref-panel--chart">
            <div className="ref-panel__head">
              <div>
                <h2 className="ref-panel__title">Mapa de gastos do mês</h2>
                <p className="ref-panel__subtitle">{mesLabel}</p>
              </div>
            </div>
            <div className="ref-chart-wrap">
              {loading ? (
                <div className="skeleton skeleton-chart-area ref-chart-skeleton" />
              ) : (
                <svg
                  className="ref-chart-svg"
                  viewBox={`0 0 ${linePath.w || 320} ${linePath.h || 100}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={linePath.d}
                    fill="none"
                    stroke="#111827"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
            </div>
          </article>

          <article className="ref-panel ref-panel--receipts">
            <div className="ref-panel__head">
              <div>
                <h2 className="ref-panel__title">Recibos</h2>
                <p className="ref-panel__subtitle">
                  {mesLabel}
                  {receitasDestaque.length > 0 ? ` · ${receitasDestaque.length} lançamentos` : ''}
                </p>
              </div>
            </div>
            <div className="ref-receipt-stack">
              {loading ? (
                <div className="skeleton-stagger">
                  <div className="skeleton skeleton-card ref-receipt-skel" />
                  <div className="skeleton skeleton-card ref-receipt-skel" />
                </div>
              ) : receitasDestaque.length === 0 ? (
                <p className="ref-empty">Sem receitas no período.</p>
              ) : (
                receitasDestaque.map((t) => (
                  <div key={t.id} className="ref-receipt-card">
                    <div className="ref-receipt-card__icon" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                    </div>
                    <div className="ref-receipt-card__text min-w-0">
                      <p className={`ref-receipt-card__val ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(t.valor)}</p>
                      <p className="ref-receipt-card__cat break-words">{t.categorias?.nome || 'Receita'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <div className="ref-fab-wrap">
          <button type="button" className="ref-fab" onClick={() => setIsModalOpen(true)} title="Nova transação">
            +
          </button>
        </div>
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
