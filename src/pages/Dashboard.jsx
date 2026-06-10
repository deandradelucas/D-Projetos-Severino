import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './dashboard.css'
import TransactionModal from '../components/TransactionModal'
import OnboardingChecklist from '../components/OnboardingChecklist'
import RecorrenciaArrowIcon from '../components/RecorrenciaArrowIcon'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import { useTheme } from '../context/ThemeContext'
import { useTransactionCache } from '../context/transactionCacheStore'
import {
  familiaMostrarQuemLancouNaUi,
  readHorizonteUser,
  readHorizonteUserPainelState,
  subscribeHorizonteSessionRefresh,
} from '../lib/horizonteSession'
import { primeiroNomeExibicao } from '../lib/primeiroNomeExibicao'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { formatTransacaoListDateTime } from '../lib/transacaoDateDisplay'
import { getSaudacao } from '../lib/getSaudacao'
import { getWhatsappContactUrl } from '../lib/whatsappContactUrl.js'
import { SkeletonKpi, SkeletonTxRow } from '../components/dashboard/DashboardSkeletons'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { TransacaoCategoriaIcon } from '../components/TransacaoCategoriaIcon'
import PwaInstallBanner from '../components/PwaInstallBanner'
import { useMatchMaxWidth } from '../hooks/useMatchMaxWidth'
import { useFabCompact } from '../hooks/useFabCompact'

/* Ícone SVG do insight da Severino IA, por tom (substitui os emojis do backend). */
function InsightIcon({ tom }) {
  const common = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  switch (tom) {
    case 'positivo':
      return (<svg {...common}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>)
    case 'alerta':
      return (<svg {...common}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>)
    case 'destaque':
      return (<svg {...common}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>)
    default: /* neutro */
      return (<svg {...common}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>)
  }
}

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { privacyMode, togglePrivacy } = useTheme()
  const isMobile = useMatchMaxWidth(768)
  const [usuario, setUsuario] = useState(() => readHorizonteUserPainelState())
  const [menuAberto, setMenuAberto] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  // FAB padrão: encolhe ao rolar (ver useFabCompact / AGENTS.md «FAB padrão»)
  const fabScrollRef = useRef(null)
  const fabCompact = useFabCompact(fabScrollRef)
  const [proximoCompromisso, setProximoCompromisso] = useState(null)

  /* Severino IA — insights proativos (regras determinísticas no backend, sem custo de IA) */
  const [insights, setInsights] = useState([])
  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await apiFetch(apiUrl('/api/insights'), { cache: 'no-store' })
        const data = res.ok ? await res.json() : []
        if (!cancel) setInsights(Array.isArray(data) ? data : [])
      } catch {
        /* silencioso — feature não-crítica */
      }
    })()
    return () => { cancel = true }
  }, [])

  // Navegação por setas no track de insights da Severino IA (sem barra de rolagem)
  const iaTrackRef = useRef(null)
  const [iaNav, setIaNav] = useState({ prev: false, next: false })
  const updateIaNav = useCallback(() => {
    const el = iaTrackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setIaNav({ prev: el.scrollLeft > 4, next: el.scrollLeft < max - 4 })
  }, [])
  useEffect(() => {
    const el = iaTrackRef.current
    if (!el) return undefined
    updateIaNav()
    // roda do mouse (vertical) rola o track na horizontal — só sequestra quando
    // ainda dá pra rolar pro lado; nas pontas, deixa a página rolar normal.
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (!delta) return
      const max = el.scrollWidth - el.clientWidth
      if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max - 1)) return
      e.preventDefault()
      el.scrollLeft += delta
    }
    el.addEventListener('scroll', updateIaNav, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', updateIaNav)
    return () => {
      el.removeEventListener('scroll', updateIaNav)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', updateIaNav)
    }
  }, [updateIaNav, insights.length])
  const scrollIa = useCallback((dir) => {
    const el = iaTrackRef.current
    if (!el) return
    const amount = Math.max(el.clientWidth * 0.8, 280)
    el.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }, [])

  // Consome a store de cache compartilhada — sem fetch local duplicado
  const {
    transacoes,
    loadingInitial: loading,
    revalidating: refreshing,
    error: fetchError,
    fetchTransacoes,
  } = useTransactionCache()

  useEffect(() => {
    const u = readHorizonteUser()
    if (u) queueMicrotask(() => setUsuario((prev) => ({ ...prev, ...u })))
  }, [])

  useEffect(() => {
    return subscribeHorizonteSessionRefresh((u) => {
      if (u) setUsuario((prev) => ({ ...prev, ...u }))
    })
  }, [])

  // Carrega dados ao montar (usa cache se disponível, revalida silenciosamente)
  useEffect(() => {
    const u = readHorizonteUser()
    if (u?.id) queueMicrotask(() => void fetchTransacoes())
  }, [fetchTransacoes, usuario.id])

  // Próximo compromisso da agenda (próximos 60 dias)
  useEffect(() => {
    if (!usuario?.id) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const from = new Date()
        const to = new Date(from)
        to.setDate(to.getDate() + 60)
        const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
        const res = await apiFetch(apiUrl(`/api/agenda?${params.toString()}`), { cache: 'no-store' })
        if (cancelled || !res.ok) return
        const data = await res.json().catch(() => [])
        const agora = Date.now() - 3600000 // tolerância de 1h (compromisso em andamento)
        const prox = (Array.isArray(data) ? data : [])
          .filter((e) => e?.inicio && new Date(e.inicio).getTime() >= agora)
          .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0] || null
        if (!cancelled) setProximoCompromisso(prox)
      } catch { /* silencioso — feature opcional */ }
    })()
    return () => { cancelled = true }
  }, [usuario?.id])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('acao') !== 'nova-transacao') return
    queueMicrotask(() => setIsModalOpen(true))
    params.delete('acao')
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' },
      { replace: true }
    )
  }, [location.pathname, location.search, navigate])

  // Re-fetch ao retomar visibilidade em caso de erro
  useEffect(() => {
    if (!fetchError) return
    let timeoutId
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
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
        // Parcelas futuras (PENDENTE) não entram no saldo realizado
        if (t.status === 'PENDENTE') return acc
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

  // Data efetiva da transação: parcela exibe/ordena pela data da COMPRA (data_compra),
  // não pelo vencimento (data_transacao). Mesma regra do TransacaoRow / transacoesDerived.
  const txRecentes = useMemo(() => {
    const dataEfetiva = (t) => (t.recorrente_index && t.data_compra ? t.data_compra : t.data_transacao)
    return [...transacoes]
      .sort((a, b) => String(dataEfetiva(b) ?? '').localeCompare(String(dataEfetiva(a) ?? '')))
      .slice(0, 8)
  }, [transacoes])

  // Despesas por categoria (top 5) para o mini-gráfico de barras
  const despesasPorCategoria = useMemo(() => {
    const map = {}
    for (const t of transacoes) {
      if (t.tipo !== 'DESPESA') continue
      const nome = (t.categorias?.nome && String(t.categorias.nome).trim()) || 'Sem categoria'
      map[nome] = (map[nome] || 0) + Math.abs(parseFloat(t.valor) || 0)
    }
    const rows = Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    const max = rows[0]?.valor || 1
    return rows.slice(0, 5).map((r) => ({ ...r, pct: Math.max(4, Math.round((r.valor / max) * 100)) }))
  }, [transacoes])

  const nomeExibicao = useMemo(() => primeiroNomeExibicao(usuario), [usuario])
  const iniciaisAvatar = useMemo(
    () => String(usuario?.nome || nomeExibicao || 'U').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    [usuario, nomeExibicao],
  )

  const mostrarQuemLancou = useMemo(() => familiaMostrarQuemLancouNaUi(usuario), [usuario])

  const whatsappContactUrl = useMemo(() => getWhatsappContactUrl(), [])

  const formatCurrency = formatCurrencyBRL

  const fmtCompromisso = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const data = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${data} · ${hora}`
  }

  const dataHojeFormatada = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
    const partes = fmt.formatToParts(new Date())
    const weekday = (partes.find((p) => p.type === 'weekday')?.value || '').replace(/-feira/i, '')
    const day = partes.find((p) => p.type === 'day')?.value || ''
    const month = partes.find((p) => p.type === 'month')?.value?.replace('.', '') || ''
    const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
    return `${weekdayCap}, ${day} ${month}`
  }, [])

  const saldoValorClass =
    saldoTotal > 0
      ? 'dashboard-hub__balance-value--positive'
      : saldoTotal < 0
        ? 'dashboard-hub__balance-value--negative'
        : 'dashboard-hub__balance-value--zero'

  return (
    <>
    <div className="dashboard-container dashboard-page ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
        <div className="ref-dashboard-inner dashboard-hub">
        <RefDashboardScroll ref={fabScrollRef}>
        <section className="dashboard-hub__hero" aria-label="Painel e ações rápidas">
          <div className="dashboard-hub__hero-row">
            <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
            <div className="dashboard-hub__hero-main">
              <div className="dashboard-hub__hero-top">
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">
                    {getSaudacao()}, <span className={privacyMode ? 'privacy-blur' : ''}>{nomeExibicao}</span>
                  </h1>
                  <time className="dashboard-hub__date" dateTime={new Date().toISOString().slice(0, 10)}>
                    {dataHojeFormatada}
                  </time>
                </div>
                <div className="dashboard-hub__hero-actions" role="toolbar" aria-label="Atalhos do painel">
                  <button type="button" data-tutorial-id="nova-transacao-btn" className="dashboard-hub__btn dashboard-hub__btn--primary" onClick={() => setIsModalOpen(true)}>
                    + Nova transação
                  </button>
                  <a
                    href={whatsappContactUrl || '#'}
                    target={whatsappContactUrl ? '_blank' : undefined}
                    rel={whatsappContactUrl ? 'noopener noreferrer' : undefined}
                    tabIndex={whatsappContactUrl ? undefined : -1}
                    data-tutorial-id="whatsapp-btn"
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
                  <button
                    type="button"
                    className="dashboard-hub__avatar"
                    onClick={() => navigate('/configuracoes')}
                    aria-label="Sua conta"
                    title="Sua conta"
                  >
                    {usuario?.avatar_url ? (
                      <img src={usuario.avatar_url} alt="" className="dashboard-hub__avatar-img" />
                    ) : (
                      <span className="dashboard-hub__avatar-initials">{iniciaisAvatar}</span>
                    )}
                  </button>
                </div>
              </div>
              <div className="dashboard-hub__balance-line dashboard-hub__balance-line--hero" aria-label="Saldo disponível no painel">
                <span className="dashboard-hub__balance-line-label">Saldo disponível</span>
                <strong className={[privacyMode ? 'privacy-blur' : '', saldoValorClass].filter(Boolean).join(' ')}>
                  {formatCurrency(saldoTotal)}
                </strong>
              </div>
            </div>
            <div className="dashboard-hub__hero-chart" aria-hidden>
              <div
                className="dashboard-hub__donut"
                style={{ '--entrada-pct': `${totalDespesas + totalReceitas > 0 ? Math.round((totalReceitas / (totalDespesas + totalReceitas)) * 100) : 50}%` }}
              >
                <span className="dashboard-hub__donut-hole">no mês</span>
              </div>
              <div className="dashboard-hub__donut-legend">
                <span className="dashboard-hub__donut-leg dashboard-hub__donut-leg--in">Entrada</span>
                <span className="dashboard-hub__donut-leg dashboard-hub__donut-leg--out">Saída</span>
              </div>
            </div>
          </div>
        </section>

        <OnboardingChecklist
          onRegistrarGasto={() => setIsModalOpen(true)}
          refreshSignal={transacoes.length}
        />

        {isMobile && <PwaInstallBanner />}

        <section
          className={`ref-kpi-row ref-dashboard-kpi-strip dashboard-hub__kpis${refreshing ? ' page-panel--refreshing' : ''}`}
          aria-label="Entrada e saída do período"
          aria-busy={loading || refreshing}
        >
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <article className="ref-kpi-card ref-kpi-card--expense">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg className="ref-kpi-card__icon-img" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 5v13.5M12 18.5l-6-6M12 18.5l6-6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Saída</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalDespesas)}</p>
                </div>
                <div className="ref-kpi-card__pct" aria-hidden>
                  <span className="ref-kpi-card__pct-value">
                    {totalDespesas + totalReceitas > 0 ? Math.round((totalDespesas / (totalDespesas + totalReceitas)) * 100) : 0}%
                  </span>
                  <span className="ref-kpi-card__pct-label">do total</span>
                </div>
              </article>
              <article className="ref-kpi-card ref-kpi-card--income">
                <div className="ref-kpi-card__icon" aria-hidden>
                  <svg className="ref-kpi-card__icon-img" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 19V5.5M12 5.5l-6 6M12 5.5l6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="ref-kpi-card__body">
                  <p className="ref-kpi-card__label">Entrada</p>
                  <p className={`ref-kpi-card__value ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(totalReceitas)}</p>
                </div>
                <div className="ref-kpi-card__pct" aria-hidden>
                  <span className="ref-kpi-card__pct-value">
                    {totalDespesas + totalReceitas > 0 ? Math.round((totalReceitas / (totalDespesas + totalReceitas)) * 100) : 0}%
                  </span>
                  <span className="ref-kpi-card__pct-label">do total</span>
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

        <div className="dashboard-hub__band">
          {insights.length > 0 && (
            <section className="ai-insights" aria-label="Insights da Severino IA">
            <div className="ai-insights__head">
              <span className="ai-insights__spark" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 14.5 8.5 20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
                </svg>
              </span>
              <span className="ai-insights__title">Severino IA</span>
              <span className="ai-insights__sub">o que percebi nas suas finanças</span>
            </div>
            <div className="ai-insights__track-wrap">
              <div className="ai-insights__track" ref={iaTrackRef}>
                {insights.map((it) => (
                  <article key={it.id} className={`ai-insight ai-insight--${it.tom || 'neutro'}`}>
                    <span className="ai-insight__icon"><InsightIcon tom={it.tom || 'neutro'} /></span>
                    <div className="ai-insight__body">
                      <h3 className="ai-insight__title">{it.titulo}</h3>
                      <p className="ai-insight__text">{it.texto}</p>
                    </div>
                  </article>
                ))}
              </div>
              {iaNav.prev && (
                <button type="button" className="ai-insights__nav ai-insights__nav--prev" onClick={() => scrollIa(-1)} aria-label="Ver anteriores">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
                </button>
              )}
              {iaNav.next && (
                <button type="button" className="ai-insights__nav ai-insights__nav--next" onClick={() => scrollIa(1)} aria-label="Ver próximos">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                </button>
              )}
            </div>
            </section>
          )}

          {!loading && (
            <article className="ref-panel dashboard-hub__insight-card dashboard-hub__insight-card--next">
              <div className="ref-panel__head">
                <h2 className="ref-panel__title">Próximo compromisso</h2>
                <Link to="/agenda" className="ref-panel__link">
                  <span>Agenda</span>
                  <svg className="ref-panel__link-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                </Link>
              </div>
              {proximoCompromisso ? (
                <Link to="/agenda" className="dashboard-hub__next">
                  <span className="dashboard-hub__next-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  </span>
                  <span className="dashboard-hub__next-info">
                    <span className="dashboard-hub__next-title">{proximoCompromisso.titulo}</span>
                    <span className="dashboard-hub__next-when">
                      {fmtCompromisso(proximoCompromisso.inicio)}{proximoCompromisso.local ? ` · ${proximoCompromisso.local}` : ''}
                    </span>
                  </span>
                </Link>
              ) : (
                <p className="dashboard-hub__insight-empty">Nenhum compromisso à vista. <span aria-hidden="true">🎉</span></p>
              )}
            </article>
          )}
        </div>

        {!loading && (
          <section className="dashboard-hub__insights dashboard-hub__insights--single" aria-label="Despesas por categoria">
            <article className="ref-panel dashboard-hub__insight-card">
              <div className="ref-panel__head">
                <h2 className="ref-panel__title">Despesas por categoria</h2>
                <Link to="/relatorios" className="ref-panel__link">
                  <span>Relatórios</span>
                  <svg className="ref-panel__link-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                </Link>
              </div>
              {despesasPorCategoria.length > 0 ? (
                <ul className="dashboard-hub__bars">
                  {despesasPorCategoria.map((d) => (
                    <li key={d.nome} className="dashboard-hub__bar-row">
                      <span className="dashboard-hub__bar-label" title={d.nome}>{d.nome}</span>
                      <span className="dashboard-hub__bar-track" aria-hidden>
                        <span className="dashboard-hub__bar-fill" style={{ width: `${d.pct}%` }} />
                      </span>
                      <span className={`dashboard-hub__bar-val ${privacyMode ? 'privacy-blur' : ''}`}>{formatCurrency(d.valor)}</span>
                      <span className="dashboard-hub__bar-pct">{totalDespesas > 0 ? Math.round((d.valor / totalDespesas) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-hub__insight-empty">Sem despesas no período.</p>
              )}
            </article>
          </section>
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
                    const isParcela = Boolean(t.recorrente_index)
                    const isRecorrente = !isParcela && Boolean(t.recorrencia_mensal_id)
                    const isPendente = t.status === 'PENDENTE'
                    const isRec = t.tipo === 'RECEITA'
                    const dataExibir = isParcela && t.data_compra ? t.data_compra : t.data_transacao
                    const { line: dateLine, dateTimeAttr } = formatTransacaoListDateTime(dataExibir)
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
                            <TransacaoCategoriaIcon
                              categoriaNome={catNome}
                              subcategoriaNome={subNome}
                              isReceita={isRec}
                              size={16}
                            />
                          </div>
                        </div>
                        <div className="ref-tx-meta-cell">
                          <div className="ref-tx-meta-primary">
                            <time className="ref-tx-date" dateTime={dateTimeAttr}>
                              {dateLine}
                            </time>
                            {isParcela ? (
                              <span className="ref-tx-rec-badge" title={`Parcela ${t.recorrente_index} de ${t.recorrente_total}`}>
                                {t.recorrente_index}/{t.recorrente_total}
                              </span>
                            ) : null}
                            {isRecorrente ? (
                              <span
                                className="ref-tx-recorrencia-ico-wrap ref-tx-recorrencia-ico-wrap--inline-meta"
                                title="Assinatura mensal sem prazo"
                                aria-label="Lançamento recorrente"
                              >
                                <RecorrenciaArrowIcon size={14} className="ref-tx-recorrencia-ico" />
                              </span>
                            ) : null}
                          </div>
                          {isPendente ? (
                            <span className="ref-tx-pendente-chip">Pendente</span>
                          ) : null}
                          {mostrarQuemLancou && t.lancado_por_nome ? (
                            <span className={`ref-tx-lancador ${privacyMode ? 'privacy-blur' : ''}`} title="Quem registrou este lançamento">
                              Lançado por {t.lancado_por_nome}
                            </span>
                          ) : null}
                        </div>
                        <div className="ref-tx-cat-cell">
                          <span className="ref-tx-field-label">Categoria</span>
                          <p className="ref-tx-cat-text break-words">
                            <span
                              className={`ref-tx-tipo-pulse ${isRec ? 'ref-tx-tipo-pulse--receita' : 'ref-tx-tipo-pulse--despesa'}`}
                              role="img"
                              aria-label={isRec ? 'Receita' : 'Despesa'}
                            />
                            <span className="ref-tx-cat-text__label">{catNome}</span>
                          </p>
                        </div>
                        <div className="ref-tx-sub-cell">
                          <span className="ref-tx-field-label">Subcategoria</span>
                          <p className="ref-tx-sub-text break-words">{subNome}</p>
                        </div>
                        <div className="ref-tx-rec-cell">
                          {isParcela ? (
                            <span
                              className="ref-tx-recorrencia-ico-wrap"
                              title={`Parcelamento ${t.recorrente_index}/${t.recorrente_total}`}
                              aria-label={`Parcela ${t.recorrente_index} de ${t.recorrente_total}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                                <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
                                <path d="M6 15h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
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

    {!isModalOpen && (
      <div className="dashboard-mobile-fabs">
        <button
          type="button"
          data-tutorial-id="nova-transacao-btn"
          className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
          onClick={() => setIsModalOpen(true)}
          aria-label="Criar nova transação"
        >
          <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <span className="dashboard-mobile-tx-fab__label">Nova transação</span>
        </button>
      </div>
    )}

    <TransactionModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onSave={fetchTransacoes}
      usuarioId={readHorizonteUser()?.id || usuario.id}
    />
    </>
  )
}
