import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useWhatsAppContactUrl } from '../hooks/useWhatsAppContactUrl'
import { Link } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import RecorrenciaArrowIcon from '../components/RecorrenciaArrowIcon'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { apiUrl } from '../lib/apiUrl'
import { fetchWithRetry } from '../lib/fetchWithRetry'
import { syncRecorrenciasMensais } from '../lib/syncRecorrenciasMensais'
import { readHorizonteUser, readHorizonteUserPainelState } from '../lib/horizonteSession'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { primeiroNomeExibicao } from '../lib/primeiroNomeExibicao'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { SkeletonKpi, SkeletonTxRow } from '../components/dashboard/DashboardSkeletons'
import RefDashboardScroll from '../components/RefDashboardScroll'

export default function Dashboard() {
  const { privacyMode, togglePrivacy } = useTheme()
  const [usuario, setUsuario] = useState(() => readHorizonteUserPainelState())
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [transacoes, setTransacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const firstFetchDoneRef = useRef(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) {
      queueMicrotask(() => setUsuario((prev) => ({ ...prev, ...u })))
    }
  }, [])

  useEffect(() => {
    firstFetchDoneRef.current = false
  }, [usuario.id])

  const fetchTransacoes = useCallback(async () => {
    const isInitial = !firstFetchDoneRef.current
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setFetchError('')
    const session = readHorizonteUser()
    if (!session?.id) {
      setTransacoes([])
      setFetchError('Sessão inválida. Faça login novamente.')
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      await syncRecorrenciasMensais(session.id)
      const res = await fetchWithRetry(apiUrl('/api/transacoes'), {
        headers: { 'x-user-id': String(session.id).trim() },
        cache: 'no-store',
      })

      if (redirectAssinaturaExpiradaSe403(res)) return

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
      setRefreshing(false)
      firstFetchDoneRef.current = true
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
  }, [fetchTransacoes, usuario.id])

  useEffect(() => {
    let timeoutId
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !fetchError) return
      const u = readHorizonteUser()
      if (!u?.id) return
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => void fetchTransacoes(), 500)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchTransacoes, fetchError])

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

  const nomeExibicao = useMemo(() => primeiroNomeExibicao(usuario), [usuario])

  const whatsappContactUrl = useWhatsAppContactUrl()

  const formatCurrency = formatCurrencyBRL

  return (
    <>
    <div className="dashboard-container dashboard-page ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll>
        <section className="dashboard-hub__hero" aria-label="Painel e ações rápidas">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div className="dashboard-hub__hero-text">
              <h1 className="dashboard-hub__title">
                Olá, <span className={privacyMode ? 'privacy-blur' : ''}>{nomeExibicao}</span>
              </h1>
            </div>
            <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Atalhos do painel">
              <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={() => setIsModalOpen(true)}>
                + Nova transação
              </button>
              <a
                href={whatsappContactUrl || '#'}
                target={whatsappContactUrl ? '_blank' : undefined}
                rel={whatsappContactUrl ? 'noopener noreferrer' : undefined}
                tabIndex={whatsappContactUrl ? undefined : -1}
                className={`dashboard-hub__icon-btn dashboard-hub__icon-btn--wa ${!whatsappContactUrl ? 'dashboard-hub__icon-btn--disabled' : ''}`}
                aria-label="Abrir WhatsApp"
                title={
                  whatsappContactUrl
                    ? 'WhatsApp'
                    : 'Configure VITE_WHATSAPP_* no build ou WHATSAPP_CONTACT_* no servidor'
                }
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <button
                type="button"
                className={`dashboard-hub__icon-btn dashboard-hub__icon-btn--privacy ${privacyMode ? 'dashboard-hub__icon-btn--privacy-on' : ''}`}
                onClick={togglePrivacy}
                aria-pressed={privacyMode}
                aria-label={privacyMode ? 'Mostrar valores e nome' : 'Ocultar valores e nome (modo privacidade)'}
                title="Modo privacidade"
              >
                {privacyMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.733 5.076A10.744 10.744 0 0 1 12 5c7 0 10 7 10 7a13.165 13.165 0 0 1-1.555 2.665" />
                    <path d="M6.52 6.52A13.134 13.134 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 4.29-.973" />
                    <path d="M2 2l20 20" />
                    <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </section>

        <section
          className={`ref-kpi-row ref-dashboard-kpi-strip dashboard-hub__kpis${refreshing ? ' page-panel--refreshing' : ''}`}
          aria-label="Saldo em conta, entrada e saída do período"
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
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

        {fetchError && (
          <div className="ref-alert" role="alert">
            <span className="ref-alert__text">{fetchError}</span>
            <button type="button" className="ref-alert__retry" onClick={() => void fetchTransacoes()}>
              Tentar novamente
            </button>
          </div>
        )}

        <section
          className={`ref-bottom-grid ref-bottom-grid--single${refreshing ? ' page-panel--refreshing' : ''}`}
          aria-label="Transações recentes"
        >
          <article className="ref-panel ref-panel--transactions dashboard-hub__tx-panel">
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
                    <span className="ref-tx-list-head__rec" aria-hidden="true" />
                    <span className="ref-tx-list-head__val">Valor</span>
                  </div>
                  {txRecentes.map((t) => {
                    const mostraIconeRecorrente = Boolean(t.recorrencia_mensal_id) || Boolean(t.recorrente_index)
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
                        <div className="ref-tx-rec-cell">
                          {mostraIconeRecorrente ? (
                            <span
                              className="ref-tx-recorrencia-ico-wrap"
                              title="Lançamento recorrente"
                              aria-label="Lançamento recorrente"
                            >
                              <RecorrenciaArrowIcon size={14} className="ref-tx-recorrencia-ico" />
                            </span>
                          ) : null}
                        </div>
                        <div className="ref-tx-val-cell">
                          <span
                            className={`ref-tx-val ${isRec ? 'ref-tx-val--pos' : 'ref-tx-val--neg'} ${privacyMode ? 'privacy-blur' : ''}`}
                          >
                            <span className="ref-tx-val__amount">
                              {isRec ? '+' : '−'}
                              {formatCurrency(Math.abs(parseFloat(t.valor) || 0))}
                            </span>
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

        </RefDashboardScroll>
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
