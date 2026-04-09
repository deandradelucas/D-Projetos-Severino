import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
      queueMicrotask(() => {
        setLoading(false)
        setFetchError('Faça login para ver suas transações.')
      })
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

  const txRecentes = useMemo(() => transacoes.slice(0, 8), [transacoes])

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  return (
    <>
    <div className="dashboard-container dashboard-page ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner">
        <div className="ref-dashboard-top">
          <div className="ref-dashboard-top__left">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
          </div>
        </div>

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
        </section>

        <section className="ref-bottom-grid ref-bottom-grid--single" aria-label="Transações recentes">
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
        </section>

        <div className="ref-fab-wrap">
          <button type="button" className="ref-fab" onClick={() => setIsModalOpen(true)} title="Nova transação">
            +
          </button>
        </div>
        </div>
        </main>
      </div>
    </div>

    <TransactionModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSave={fetchTransacoes}
      usuarioId={readHorizonteUser()?.id || usuario.id}
    />
    </>
  )
}
