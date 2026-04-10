import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { readHorizonteUser } from '../lib/horizonteSession'
import { getWhatsAppContactUrl } from '../lib/whatsappContactUrl'

const SkeletonKpi = () => (
  <div className="ref-kpi-card ref-kpi-card--skeleton" aria-hidden>
    <div className="skeleton skeleton-pulse ref-kpi-skel-icon" />
    <div className="ref-kpi-skel-body">
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--label" />
      <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--value" />
    </div>
  </div>
)

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

  const nomeExibicao = useMemo(() => {
    const n = String(usuario?.nome || usuario?.usuario || '').trim()
    return n || 'usuário'
  }, [usuario])

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
        /* offline / API indisponível */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [whatsappContactUrl])

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
        <header className="ref-dashboard-header">
          <MobileMenuButton onClick={() => setMenuAberto(true)} />
          <div className="ref-dashboard-header__lead">
            <h1 className="ref-dashboard-greeting">
              <span className="ref-dashboard-greeting__prefix">Olá,</span>
              {` `}
              <span className={`ref-dashboard-greeting__name ${privacyMode ? 'privacy-blur' : ''}`}>{nomeExibicao}</span>
            </h1>
          </div>
        </header>

        <article className="ref-panel ref-dashboard-actions-card" aria-label="Ações rápidas">
          <div className="ref-dashboard-actions-card__toolbar" role="toolbar" aria-label="Nova transação e WhatsApp">
            <button type="button" className="ref-dashboard-header__btn-tx" onClick={() => setIsModalOpen(true)}>
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
        </article>

        <section className="ref-dashboard-saldo-card" aria-label="Saldo em conta" aria-busy={loading}>
          {loading ? (
            <SkeletonKpi />
          ) : (
            <article className="ref-kpi-card ref-kpi-card--balance ref-kpi-card--hero">
              <div className="ref-kpi-card__icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                  <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>
              <div className="ref-kpi-card__body">
                <p className="ref-kpi-card__label">Saldo em Conta</p>
                <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(saldoTotal)}</p>
              </div>
            </article>
          )}
        </section>

        {fetchError && (
          <div className="ref-alert" role="alert">
            <span className="ref-alert__text">{fetchError}</span>
            <button type="button" className="ref-alert__retry" onClick={() => void fetchTransacoes()}>
              Tentar novamente
            </button>
          </div>
        )}

        <section className="ref-kpi-row ref-kpi-row--secondary" aria-label="Entrada e saída do período" aria-busy={loading}>
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <article className="ref-kpi-card ref-kpi-card--expense">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Saída</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalDespesas)}</p>
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
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalReceitas)}</p>
                </div>
              </article>
            </>
          )}
        </section>

        <section className="ref-bottom-grid ref-bottom-grid--single" aria-label="Transações recentes">
          <article className="ref-panel ref-panel--transactions">
            <div className="ref-panel__head">
              <h2 className="ref-panel__title">Transações</h2>
              <Link to="/transacoes" className="ref-panel__link">
                <span>Ver todas</span>
                <svg className="ref-panel__link-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
            <div className="ref-tx-list">
              {loading ? (
                <div className="skeleton-stagger ref-tx-skeleton-stack">
                  <SkeletonTxRow />
                  <SkeletonTxRow />
                  <SkeletonTxRow />
                </div>
              ) : txRecentes.length === 0 ? (
                <div className="ref-empty-state">
                  <p className="ref-empty">Nenhuma transação ainda. Comece registrando uma receita ou despesa.</p>
                  <button type="button" className="ref-empty-cta" onClick={() => setIsModalOpen(true)}>
                    Nova transação
                  </button>
                </div>
              ) : (
                <div className="ref-tx-table-subgrid">
                  <div className="ref-tx-list-head">
                    <span className="ref-tx-list-head__icon" aria-hidden />
                    <span className="ref-tx-list-head__meta">Data</span>
                    <span className="ref-tx-list-head__cat">Categoria</span>
                    <span className="ref-tx-list-head__sub">Subcategoria</span>
                    <span className="ref-tx-list-head__val">Valor</span>
                  </div>
                  {txRecentes.map((t) => {
                    const isRec = t.tipo === 'RECEITA'
                    const dt = new Date(t.data_transacao)
                    const dateLine = dt.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                    const isoDate = Number.isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10)
                    const catNome = (t.categorias?.nome && String(t.categorias.nome).trim()) || '—'
                    const subRaw = t.subcategorias
                    const subNome =
                      subRaw && typeof subRaw === 'object' && subRaw.nome && String(subRaw.nome).trim()
                        ? String(subRaw.nome).trim()
                        : '—'
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
                        </div>
                        <div className="ref-tx-cat-cell">
                          <span className="ref-tx-field-label">Categoria</span>
                          <p className="ref-tx-cat-text break-words">{catNome}</p>
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
                            {formatCurrency(Math.abs(parseFloat(t.valor) || 0))}
                          </span>
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
      onClose={() => setIsModalOpen(false)}
      onSave={fetchTransacoes}
      usuarioId={readHorizonteUser()?.id || usuario.id}
    />
    </>
  )
}
