import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '@components/Sidebar'
import MobileMenuButton from '@components/MobileMenuButton'
import RefDashboardScroll from '@components/RefDashboardScroll'
import PagamentoPainelLateral from '../components/pagamento/PagamentoPainelLateral.jsx'
import PagamentoOrientacaoCard from '../components/pagamento/PagamentoOrientacaoCard.jsx'
import PagamentoDetalhesCard from '../components/pagamento/PagamentoDetalhesCard.jsx'
import PagamentoHistorico from '../components/pagamento/PagamentoHistorico.jsx'
import PagamentoPixQrModal from '../components/pagamento/PagamentoPixQrModal.jsx'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { maskCpfCnpj, validateCpfCnpj } from '../lib/cpfCnpjUtils.js'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  PLANO_PADRAO_TITULO,
  buildOrientacaoUsuario,
  painelAssinaturaFromUser,
  ultimoPagamentoHistorico,
} from '../lib/pagamentoPageModel.js'
import {
  pagamentoStatusBannerClass,
  pagamentoHistoricoStatusPendente,
  computeDescontoAnual,
  computeDiasRestantesTrial,
  trialUrgenciaVariant as calcTrialUrgenciaVariant,
  trialUrgenciaMsg as calcTrialUrgenciaMsg,
  trialProgresso as calcTrialProgresso,
  computeEconomiaAnual,
  computeStatusBadge,
} from '../lib/pagamentoUi'
import './dashboard.css'
import '../styles/pages/pagamento.css'

const POLL_ASSINATURA_MS = 18_000
const POLL_ASSINATURA_MAX_MS = 4 * 60_000

export default function Pagamento() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const [config, setConfig] = useState({
    ready: false,
    publicKey: null,
    isento_pagamento: false,
  })
  const [precosCatalogo, setPrecosCatalogo] = useState({ mensal: 10, anual: 100 })
  const [planoCheckout, setPlanoCheckout] = useState(() => /** @type {'mensal' | 'anual'} */ ('anual'))
  const [cancelMotivo, setCancelMotivo] = useState('')
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [dadosErro, setDadosErro] = useState('')
  const [titulo] = useState(PLANO_PADRAO_TITULO)
  const [proximaCobranca, setProximaCobranca] = useState(null)
  const [painelAssinatura, setPainelAssinatura] = useState(() => painelAssinaturaFromUser(null))

  const [pixModalOpen, setPixModalOpen] = useState(false)
  const [pixLoading, setPixLoading] = useState(false)
  const [pixError, setPixError] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [pixNeedsCpf, setPixNeedsCpf] = useState(false)
  const [pixCpfCnpj, setPixCpfCnpj] = useState('')
  const [pixData, setPixData] = useState(null)

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('horizonte_cpf_cnpj')
    if (saved) setCpfCnpj(saved)
  }, [])

  const statusUrl = searchParams.get('status')
  const asaasCb = searchParams.get('asaas')
  const expirado = searchParams.get('expirado') === '1' || asaasCb === 'expirado'

  const formatCurrency = formatCurrencyBRL

  const fetchDados = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setDadosErro('')
      setLoading(true)
    }
    /** Leitura após sincronizar — usado pelo polling pós-checkout. */
    const snapshot = {
      assinaturaAtiva: false,
      isento: false,
      ultimoHistoricoStatus: null,
    }
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      let uid = ''
      let u = null
      try {
        u = userSaved ? JSON.parse(userSaved) : null
        uid = u?.id || ''
      } catch {
        uid = ''
      }
      if (uid && u) {
        setPainelAssinatura(painelAssinaturaFromUser(u))
        if (u.assinatura_proxima_cobranca) setProximaCobranca(u.assinatura_proxima_cobranca)
        try {
          const stRes = await apiFetch(apiUrl('/api/assinatura/status'), {
            cache: silent ? 'no-store' : undefined,
          })
          if (stRes.ok) {
            const assinatura = await stRes.json()
            const merged = { ...u, ...assinatura }
            localStorage.setItem('horizonte_user', JSON.stringify(merged))
            window.dispatchEvent(new Event('horizonte-session-refresh'))
            setPainelAssinatura(painelAssinaturaFromUser(merged))
            if (assinatura.assinatura_proxima_cobranca) {
              setProximaCobranca(assinatura.assinatura_proxima_cobranca)
            }
            snapshot.assinaturaAtiva =
              merged.assinatura_paga === true && String(merged.assinatura_situacao || '') === 'ativo'
          }
        } catch {
          /* ignore */
        }
      }

      const savedAfterAssinatura = localStorage.getItem('horizonte_user')
      let uidHistorico = ''
      try {
        uidHistorico = savedAfterAssinatura ? JSON.parse(savedAfterAssinatura).id : ''
      } catch {
        uidHistorico = ''
      }

      const [cfgRes, histRes] = await Promise.all([
        apiFetch(apiUrl('/api/pagamentos/config')),
        (async () => {
          if (!uidHistorico) return { ok: false, status: 0 }
          return apiFetch(apiUrl('/api/pagamentos/minhas'), {
            cache: silent ? 'no-store' : undefined,
          })
        })(),
      ])

      if (cfgRes.ok) {
        const c = await cfgRes.json()
        const isento = !!c.isento_pagamento
        snapshot.isento = isento
        setConfig({
          ready: !!c.ready,
          publicKey: c.publicKey,
          isento_pagamento: isento,
        })
        const pm = Number(c.preco_mensal)
        const pa = Number(c.preco_anual)
        setPrecosCatalogo({
          mensal: Number.isFinite(pm) && pm > 0 ? pm : 10,
          anual: Number.isFinite(pa) && pa > 0 ? pa : 100,
        })
      } else if (!silent) {
        setDadosErro((prev) => prev || 'Não foi possível carregar a configuração de pagamentos.')
      }

      if (histRes.ok) {
        const h = await histRes.json()
        const rows = Array.isArray(h) ? h : []
        setHistorico(rows)
        snapshot.ultimoHistoricoStatus = rows[0]?.status != null ? String(rows[0].status) : null
      } else if (uidHistorico && !silent) {
        setDadosErro((prev) => prev || 'Não foi possível carregar o histórico de cobranças.')
      }
    } catch {
      if (!silent) setDadosErro('Erro de rede ao carregar a página. Tente novamente.')
    } finally {
      if (!silent) setLoading(false)
    }
    try {
      const raw = localStorage.getItem('horizonte_user')
      const lu = raw ? JSON.parse(raw) : null
      if (lu && !snapshot.assinaturaAtiva) {
        snapshot.assinaturaAtiva =
          lu.assinatura_paga === true && String(lu.assinatura_situacao || '') === 'ativo'
      }
    } catch {
      /* ignore */
    }
    return snapshot
  }, [])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  const ultimo = useMemo(() => ultimoPagamentoHistorico(historico), [historico])
  const ultimoHistoricoPendente = useMemo(
    () => pagamentoHistoricoStatusPendente(ultimo?.status),
    [ultimo],
  )

  const descontoAnual = useMemo(() => computeDescontoAnual(precosCatalogo), [precosCatalogo])

  /**
   * Volta do checkout / cobrança pendente: sincroniza de pouco em pouco (aba visível), sem piscar o skeleton.
   * Para quando a assinatura fica ativa, a conta é isenta, o último registro deixa de estar pendente, ou esgota o tempo máximo.
   */
  useEffect(() => {
    const checkoutOk = asaasCb === 'ok'
    const urlPending = statusUrl === 'pending'
    const aguardandoCobranca =
      ultimoHistoricoPendente &&
      !config.isento_pagamento &&
      painelAssinatura.situacao !== 'admin' &&
      !painelAssinatura.paga

    const shouldPoll = checkoutOk || urlPending || aguardandoCobranca
    if (!shouldPoll) return undefined

    let cancelled = false
    let intervalId = null
    const started = Date.now()

    const limparParamsQuandoAplicavel = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (checkoutOk) next.delete('asaas')
          if (urlPending) next.delete('status')
          return next
        },
        { replace: true },
      )
    }

    const encerrarPolling = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
      limparParamsQuandoAplicavel()
    }

    const cicloResolvido = (snap) =>
      snap.isento ||
      snap.assinaturaAtiva ||
      (snap.ultimoHistoricoStatus != null && !pagamentoHistoricoStatusPendente(snap.ultimoHistoricoStatus))

    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      if (Date.now() - started > POLL_ASSINATURA_MAX_MS) {
        encerrarPolling()
        return
      }
      const snap = await fetchDados({ silent: true })
      if (cancelled) return
      if (cicloResolvido(snap)) encerrarPolling()
    }

    void tick()
    intervalId = window.setInterval(() => void tick(), POLL_ASSINATURA_MS)
    return () => {
      cancelled = true
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [
    asaasCb,
    statusUrl,
    ultimoHistoricoPendente,
    config.isento_pagamento,
    painelAssinatura.paga,
    painelAssinatura.situacao,
    fetchDados,
    setSearchParams,
  ])

  const handleCpfChange = useCallback((e) => {
    setCpfCnpj(maskCpfCnpj(e.target.value))
  }, [])

  const handlePagarAsaas = async () => {
    setError('')
    const cpfDigits = cpfCnpj.replace(/\D/g, '')
    if (!cpfDigits) {
      setError('Informe seu CPF ou CNPJ para continuar.')
      return
    }
    if (!validateCpfCnpj(cpfDigits)) {
      setError('CPF ou CNPJ inválido. Verifique os dígitos e tente novamente.')
      return
    }
    setPaying(true)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        window.location.href = '/login'
        return
      }
      JSON.parse(userSaved)

      const res = await apiFetch(apiUrl('/api/pagamentos/preferencia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano: planoCheckout === 'anual' ? 'anual' : 'mensal',
          titulo: titulo.trim() || PLANO_PADRAO_TITULO,
          cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Não foi possível iniciar o pagamento.')

      const urlCheckout = data.use_sandbox ? data.sandbox_init_point : data.init_point
      if (!urlCheckout) throw new Error('URL de checkout indisponível.')
      localStorage.setItem('horizonte_cpf_cnpj', cpfCnpj)
      window.location.href = urlCheckout
    } catch (e) {
      setError(e.message || 'Erro ao abrir o checkout Asaas.')
    } finally {
      setPaying(false)
    }
  }

  const handleGerarPixQrAnual = async () => {
    setPixError('')
    setPixLoading(true)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        window.location.href = '/login'
        return
      }
      JSON.parse(userSaved)
      const res = await apiFetch(apiUrl('/api/pagamentos/asaas/pix-anual-qrcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf_cnpj: pixCpfCnpj }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 422 && data.needs_cpf) {
        setPixNeedsCpf(true)
        setPixError(data.message || 'Informe CPF ou CNPJ.')
        setPixData(null)
        return
      }
      if (!res.ok) throw new Error(data.message || 'Não foi possível gerar o QR Code Pix.')
      setPixNeedsCpf(false)
      setPixData(data)
    } catch (e) {
      setPixError(e.message || 'Erro ao gerar QR Code Pix.')
    } finally {
      setPixLoading(false)
    }
  }

  // Gera o QR Code Pix automaticamente ao abrir o modal (sem segundo clique).
  // Se ainda não houver CPF/CNPJ, mostra o campo direto.
  useEffect(() => {
    if (!pixModalOpen) return
    if (pixData || pixLoading || pixError || pixNeedsCpf) return
    if (pixCpfCnpj && pixCpfCnpj.replace(/\D/g, '').length >= 11) {
      void handleGerarPixQrAnual()
    } else {
      setPixNeedsCpf(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixModalOpen])

  const limparStatusUrl = () => {
    searchParams.delete('status')
    setSearchParams(searchParams, { replace: true })
  }

  const fecharParamCheckout = useCallback(
    (paramKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete(paramKey)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const onAtualizar = async () => {
    await fetchDados({ silent: true })
  }

  const handleCancelarAssinatura = async () => {
    setCancelLoading(true)
    setCancelError('')
    try {
      const res = await apiFetch(apiUrl('/api/pagamentos/cancelar'), {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCancelError(data?.message || 'Erro ao cancelar. Tente novamente.')
        return
      }
      setCancelModalOpen(false)
      await fetchDados({ silent: true })
    } catch {
      setCancelError('Erro de conexão. Tente novamente.')
    } finally {
      setCancelLoading(false)
    }
  }
  const orientacao = buildOrientacaoUsuario({
    painel: painelAssinatura,
    configReady: config.ready,
    isento: config.isento_pagamento,
    historicoLen: historico.length,
  })

  const diasRestantesTrial = computeDiasRestantesTrial(painelAssinatura)

  const trialUrgenciaVariant = calcTrialUrgenciaVariant(diasRestantesTrial)

  const trialUrgenciaMsg = calcTrialUrgenciaMsg(diasRestantesTrial)

  /** Card “Conta isenta” na coluna direita vira bloco abaixo do histórico (exceto conta admin). */
  const isentaOrientacaoAbaixoHistorico =
    config.isento_pagamento && painelAssinatura.situacao !== 'admin'

  const valorCicloSelecionado = planoCheckout === 'anual' ? precosCatalogo.anual : precosCatalogo.mensal
  const unidadeCiclo = planoCheckout === 'anual' ? 'ano' : 'mês'

  // Valor/ciclo REAL da assinatura ativa (card "Sua assinatura"): usa o último
  // pagamento aprovado e infere o ciclo pelo catálogo. Só o checkout (escolha de
  // plano) usa valorCicloSelecionado; aqui mostramos o que o usuário de fato paga.
  const valorPagamentoReal = ultimo?.amount != null ? Number(ultimo.amount) : null
  const temValorRealAssinatura = painelAssinatura.paga && valorPagamentoReal != null && valorPagamentoReal > 0
  const valorAssinaturaDetalhe = temValorRealAssinatura ? valorPagamentoReal : valorCicloSelecionado
  const cicloAssinaturaDetalhe = temValorRealAssinatura
    ? (Math.abs(valorPagamentoReal - precosCatalogo.anual) < Math.abs(valorPagamentoReal - precosCatalogo.mensal) ? 'ano' : 'mês')
    : unidadeCiclo

  // Economia e equivalência do plano anual (feature 2)
  const economiaAnual = useMemo(() => computeEconomiaAnual(precosCatalogo), [precosCatalogo])
  const mensalEquivalenteAnual = useMemo(() => precosCatalogo.anual / 12, [precosCatalogo])

  // Validação inline do CPF/CNPJ (feature 8)
  const cpfDigitos = cpfCnpj.replace(/\D/g, '')
  const cpfValido = cpfDigitos.length > 0 && validateCpfCnpj(cpfDigitos)
  const cpfTocado = cpfDigitos.length >= 11

  // Progresso do trial (feature 9) — trial padrão de 7 dias
  const trialProgresso = calcTrialProgresso(diasRestantesTrial)

  // Badge de status no hero (feature 10)
  const statusBadge = computeStatusBadge(painelAssinatura, config, expirado)

  // Itens inclusos na assinatura (feature 3)
  const FEATURES_INCLUSAS = [
    'Dashboard financeiro completo',
    'Transações ilimitadas + importação de extratos',
    'Relatórios e gráficos avançados',
    'Carteira de investimentos com rendimento',
    'Agenda e lembretes via WhatsApp',
    'Lista de compras inteligente',
    'Bot do WhatsApp com IA',
  ]

  const assinarLabelCheckout =
    planoCheckout === 'anual'
      ? `Pagar ${formatCurrency(precosCatalogo.anual)} / ano com cartão`
      : `Pagar ${formatCurrency(precosCatalogo.mensal)} / mês com cartão`

  const disabledCheckout = !config.ready || paying || loading || config.isento_pagamento

  const meiosDetalhes =
    planoCheckout === 'anual'
      ? 'Pix ou cartão de crédito no checkout Asaas'
      : 'Cartão de crédito no checkout Asaas'

  // Sem painel lateral (coluna única centrada) — alinha header e conteúdo na mesma largura.
  const semLateral = isentaOrientacaoAbaixoHistorico || painelAssinatura.situacao === 'trial' || (painelAssinatura.situacao === 'ativo' && painelAssinatura.paga)

  return (
    <div className="dashboard-container page-pagamento ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
            <section className="dashboard-hub__hero page-pagamento-header" aria-label="Pagamento">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                <div className="dashboard-hub__hero-text">
                  <div className="page-pagamento-header__titlerow">
                    <h1 className="dashboard-hub__title">Pagamento</h1>
                    {statusBadge && (
                      <span className={`pagamento-status-chip pagamento-status-chip--${statusBadge.tone}`}>
                        <span className="pagamento-status-chip__dot" aria-hidden />
                        {statusBadge.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className={`page-pagamento-layout${semLateral ? ' page-pagamento-layout--sem-lateral' : ''}`}>
              <div className="page-pagamento-layout__primary">
                {diasRestantesTrial !== null && trialUrgenciaVariant && (
                  <div className={`pagamento-trial-urgencia pagamento-trial-urgencia--${trialUrgenciaVariant}`} role="alert">
                    <div className="pagamento-trial-urgencia__dias-box">
                      <span className="pagamento-trial-urgencia__num">
                        {diasRestantesTrial === 0 ? '0' : diasRestantesTrial}
                      </span>
                      <span className="pagamento-trial-urgencia__label">
                        {diasRestantesTrial === 1 ? 'dia' : 'dias'}
                      </span>
                    </div>
                    <div className="pagamento-trial-urgencia__body">
                      <p className="pagamento-trial-urgencia__title">
                        {diasRestantesTrial === 0
                          ? 'Período gratuito termina hoje'
                          : diasRestantesTrial === 1
                            ? '1 dia restante de período gratuito'
                            : `${diasRestantesTrial} dias restantes de período gratuito`}
                      </p>
                      <p className="pagamento-trial-urgencia__text">{trialUrgenciaMsg}</p>
                      <div className="pagamento-trial-urgencia__progress" aria-hidden>
                        <div
                          className="pagamento-trial-urgencia__progress-fill"
                          style={{ width: `${trialProgresso.toFixed(0)}%` }}
                        />
                      </div>
                    </div>
                    <a href="#pagamento-checkout" className="pagamento-trial-urgencia__cta">
                      Assinar agora
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
                        <path d="M2.5 6.5h8M6.5 3l3.5 3.5L6.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                )}

                {painelAssinatura.situacao === 'trial' && (
                  <PagamentoOrientacaoCard
                    variant={orientacao.variant}
                    title={orientacao.title}
                    body={orientacao.body}
                  />
                )}

                {dadosErro ? (
                  <div className="pagamento-banner pagamento-banner--danger" role="alert">
                    <p className="pagamento-banner__title">{dadosErro}</p>
                  </div>
                ) : null}

                {expirado ? (
                  <div className="pagamento-banner pagamento-banner--danger" role="alert">
                    <p className="pagamento-banner__title">Teste encerrado ou assinatura inativa.</p>
                    <p className="pagamento-banner__text">
                      Conclua o pagamento no checkout Asaas e use &quot;Atualizar status&quot;.
                    </p>
                  </div>
                ) : null}

                {asaasCb === 'cancel' ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__title">Checkout cancelado. Você pode tentar de novo quando quiser.</p>
                    <button
                      type="button"
                      className="btn-secondary btn-secondary--compact"
                      onClick={() => fecharParamCheckout('asaas')}
                    >
                      Fechar aviso
                    </button>
                  </div>
                ) : null}

                {statusUrl ? (
                  <div className={`${pagamentoStatusBannerClass(statusUrl)}${statusUrl === 'success' ? ' pagamento-banner--celebrate' : ''}`} role="status">
                    {statusUrl === 'success' && (
                      <span className="pagamento-success-check" aria-hidden>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      </span>
                    )}
                    <p className="pagamento-banner__title">
                      {statusUrl === 'success'
                        ? 'Pagamento recebido — o status atualiza em instantes no histórico.'
                        : statusUrl === 'pending'
                          ? 'Pagamento pendente. A confirmação vem pelo Asaas.'
                          : 'Não foi possível concluir. Tente outro meio ou novamente.'}
                    </p>
                    <button type="button" className="btn-secondary btn-secondary--compact" onClick={limparStatusUrl}>
                      Fechar aviso
                    </button>
                  </div>
                ) : null}

                {!config.ready && !loading ? (
                  <p className="pagamento-config-alert">
                    Checkout indisponível: configure <code>ASAAS_API_KEY</code> no servidor.
                  </p>
                ) : null}

                {loading && !config.isento_pagamento ? (
                  <div className="pagamento-checkout-skeleton" aria-busy="true" aria-label="Carregando opções de pagamento">
                    <div className="pagamento-skeleton-card">
                      <div className="pagamento-skeleton-line" />
                      <div className="pagamento-skeleton-grid">
                        <div className="pagamento-skeleton-option" />
                        <div className="pagamento-skeleton-option" />
                      </div>
                    </div>
                    <div className="pagamento-skeleton-card">
                      <div className="pagamento-skeleton-line" />
                      <div className="pagamento-skeleton-line pagamento-skeleton-line--sm" />
                      <div className="pagamento-skeleton-input" />
                      <div className="pagamento-skeleton-btn" />
                    </div>
                  </div>
                ) : null}

                {!config.isento_pagamento && !loading ? (
                  <div className="page-pagamento-oferta">
                  <div className="ref-panel page-pagamento-planos" role="radiogroup" aria-label="Plano de assinatura">
                    <p className="page-pagamento-planos__legend">Escolha o plano</p>
                    <div className="page-pagamento-planos__grid">
                      <button
                        type="button"
                        className={`page-pagamento-planos__option page-pagamento-planos__option--anual${planoCheckout === 'anual' ? ' page-pagamento-planos__option--active' : ''}`}
                        role="radio"
                        aria-checked={planoCheckout === 'anual'}
                        onClick={() => setPlanoCheckout('anual')}
                      >
                        <span className="page-pagamento-planos__ribbon">★ Mais popular</span>
                        <span className="page-pagamento-planos__option-title">
                          Anual
                          {descontoAnual > 0 ? (
                            <span className="page-pagamento-planos__badge">-{descontoAnual}%</span>
                          ) : null}
                        </span>
                        <span className="page-pagamento-planos__option-price">{formatCurrency(precosCatalogo.anual)} <span className="page-pagamento-planos__option-ciclo">/ ano</span></span>
                        {economiaAnual > 0 ? (
                          <span className="page-pagamento-planos__eq">
                            equivale a <strong>{formatCurrency(mensalEquivalenteAnual)}/mês</strong>
                          </span>
                        ) : null}
                        {economiaAnual > 0 ? (
                          <span className="page-pagamento-planos__economia">
                            <s>{formatCurrency(precosCatalogo.mensal * 12)}</s> · economize {formatCurrency(economiaAnual)}/ano
                          </span>
                        ) : (
                          <span className="page-pagamento-planos__option-hint">Cobrança anual no cartão ou Pix</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`page-pagamento-planos__option${planoCheckout === 'mensal' ? ' page-pagamento-planos__option--active' : ''}`}
                        role="radio"
                        aria-checked={planoCheckout === 'mensal'}
                        onClick={() => setPlanoCheckout('mensal')}
                      >
                        <span className="page-pagamento-planos__option-title">Mensal</span>
                        <span className="page-pagamento-planos__option-price">{formatCurrency(precosCatalogo.mensal)} <span className="page-pagamento-planos__option-ciclo">/ mês</span></span>
                        <span className="page-pagamento-planos__option-hint">Cobrança mensal no cartão · flexível</span>
                      </button>
                    </div>

                    {/* Meios de pagamento aceitos (feature 11) */}
                    <div className="page-pagamento-planos__meios" aria-label="Meios de pagamento aceitos">
                      <span className="page-pagamento-planos__meios-label">Aceitamos</span>
                      <span className="page-pagamento-meio" title="Cartão de crédito">
                        <svg width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                        Cartão
                      </span>
                      <span className="page-pagamento-meio" title="Pix">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/></svg>
                        Pix
                      </span>
                    </div>
                  </div>

                  {/* Value stack + selos de confiança (features 3 e 4) */}
                  <div className="ref-panel page-pagamento-valor">
                    <p className="page-pagamento-valor__title">Tudo isto incluso na sua assinatura</p>
                    <ul className="page-pagamento-valor__list">
                      {FEATURES_INCLUSAS.map((f) => (
                        <li key={f} className="page-pagamento-valor__item">
                          <svg className="page-pagamento-valor__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="page-pagamento-trust" aria-label="Garantias">
                      <span className="page-pagamento-trust__item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Pagamento seguro via Asaas
                      </span>
                      <span className="page-pagamento-trust__item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
                        Cancele quando quiser
                      </span>
                      <span className="page-pagamento-trust__item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
                        Sem fidelidade
                      </span>
                    </div>
                  </div>
                  </div>
                ) : null}

                {!config.isento_pagamento && config.ready && !loading ? (
                  <div id="pagamento-checkout" className="ref-panel pagamento-checkout-panel">
                    <div className="pagamento-checkout-panel__col">
                    <div className="pagamento-checkout-panel__lead">
                      <p className="pagamento-checkout-panel__lead-title">Finalizar assinatura</p>
                      <p className="pagamento-checkout-panel__lead-text">
                        Você será redirecionado para o checkout seguro da Asaas para inserir os dados do cartão.
                      </p>
                    </div>

                    {/* Resumo do pedido (feature 6) */}
                    <div className="pagamento-resumo">
                      <div className="pagamento-resumo__row">
                        <span className="pagamento-resumo__label">Plano selecionado</span>
                        <span className="pagamento-resumo__plan">
                          {planoCheckout === 'anual' ? 'Anual' : 'Mensal'}
                          {planoCheckout === 'anual' && descontoAnual > 0 ? (
                            <span className="pagamento-resumo__save">-{descontoAnual}%</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="pagamento-resumo__row pagamento-resumo__row--total">
                        <span className="pagamento-resumo__label">Total</span>
                        <span className="pagamento-resumo__total">
                          {formatCurrency(valorCicloSelecionado)}<span className="pagamento-resumo__ciclo">/{unidadeCiclo}</span>
                        </span>
                      </div>
                    </div>
                    </div>

                    <div className="pagamento-checkout-panel__col">
                    <div className="pagamento-checkout-panel__field">
                      <label htmlFor="cpf-checkout" className="pagamento-checkout-panel__label">
                        CPF ou CNPJ <span className="pagamento-checkout-panel__label-req">*</span>
                      </label>
                      <div className={`pagamento-cpf-wrap${cpfTocado ? (cpfValido ? ' pagamento-cpf-wrap--ok' : ' pagamento-cpf-wrap--err') : ''}`}>
                        <input
                          id="cpf-checkout"
                          type="text"
                          className="pagamento-checkout-panel__input"
                          value={cpfCnpj}
                          onChange={handleCpfChange}
                          placeholder="000.000.000-00"
                          maxLength={18}
                          disabled={paying}
                          autoComplete="off"
                          aria-invalid={cpfTocado && !cpfValido}
                        />
                        {cpfTocado && (
                          <span className={`pagamento-cpf-icon${cpfValido ? ' pagamento-cpf-icon--ok' : ' pagamento-cpf-icon--err'}`} aria-hidden>
                            {cpfValido ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="pagamento-checkout-panel__hint">
                        {cpfTocado && !cpfValido ? 'CPF ou CNPJ inválido — confira os dígitos.' : 'Exigido pela Asaas para identificar o pagador.'}
                      </p>
                    </div>

                    {error ? <p className="pagamento-checkout-panel__error">{error}</p> : null}

                    <button
                      type="button"
                      className="btn-primary pagamento-checkout-panel__btn-full"
                      disabled={disabledCheckout || paying || !cpfValido}
                      onClick={handlePagarAsaas}
                    >
                      {paying ? 'Redirecionando para Asaas…' : assinarLabelCheckout}
                    </button>

                    {planoCheckout === 'anual' ? (
                      <button
                        type="button"
                        className="pagamento-pix-cta pagamento-checkout-panel__btn-full"
                        disabled={paying || loading}
                        onClick={() => {
                          setPixCpfCnpj(cpfCnpj.replace(/\D/g, ''))
                          setPixData(null)
                          setPixError('')
                          setPixNeedsCpf(false)
                          setPixModalOpen(true)
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/></svg>
                        <span>Pagar à vista no Pix
                          {economiaAnual > 0 ? <span className="pagamento-pix-cta__save">economia de {formatCurrency(economiaAnual)}</span> : null}
                        </span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="btn-secondary pagamento-checkout-panel__btn-full"
                      disabled={loading || paying}
                      onClick={onAtualizar}
                    >
                      Atualizar status
                    </button>
                    </div>
                  </div>
                ) : null}

                {config.isento_pagamento && !loading ? (
                  <div className="pagamento-banner pagamento-banner--success">
                    <p className="pagamento-banner__title">Conta isenta — sem cobrança.</p>
                  </div>
                ) : null}

                <PagamentoDetalhesCard
                  tituloPlano={titulo}
                  valorCicloSelecionado={valorAssinaturaDetalhe}
                  unidadeCiclo={cicloAssinaturaDetalhe}
                  meiosPagamentoResumo={meiosDetalhes}
                  painel={painelAssinatura}
                  proximaCobranca={proximaCobranca}
                  formatCurrency={formatCurrency}
                />

                {ultimo &&
                ['rejected', 'cancelled', 'refunded', 'charged_back', 'overdue'].includes(
                  String(ultimo.status || '').toLowerCase(),
                ) ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__text">
                      Última cobrança ({formatCurrency(Number(ultimo.amount || 0))}) não está em dia.{' '}
                      {painelAssinatura.portalUrl ? (
                        <a
                          href={painelAssinatura.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pagamento-banner__link"
                        >
                          Regularize no portal Asaas
                        </a>
                      ) : (
                        'Regularize no portal Asaas'
                      )}
                      {' '}ou use &quot;Atualizar status&quot;.
                    </p>
                  </div>
                ) : null}

                <PagamentoHistorico historico={historico} loading={loading} formatCurrency={formatCurrency} />

                {painelAssinatura.situacao === 'ativo' && !loading ? (
                  <div className="pagamento-cancelar-zona">
                    <button
                      type="button"
                      className="btn-danger-ghost pagamento-cancelar-btn"
                      onClick={() => { setCancelError(''); setCancelModalOpen(true) }}
                    >
                      Cancelar assinatura
                    </button>
                  </div>
                ) : null}

                {cancelModalOpen ? createPortal(
                  <div className="pagamento-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
                    <div className="pagamento-modal">
                      <h2 id="cancel-modal-title" className="pagamento-modal__title">Antes de cancelar…</h2>

                      {/* Retenção: lembra o que perde + acesso até o fim do período (feature 13) */}
                      <div className="pagamento-retencao">
                        <p className="pagamento-retencao__lead">Ao cancelar, você perde:</p>
                        <ul className="pagamento-retencao__list">
                          {FEATURES_INCLUSAS.slice(0, 4).map((f) => (
                            <li key={f}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                        <p className="pagamento-retencao__nota">
                          Você continua com acesso até o fim do período já pago. Nada é cobrado de novo.
                        </p>
                      </div>

                      <div className="pagamento-modal__field">
                        <label htmlFor="cancel-motivo" className="pagamento-modal__label">Conta pra gente o motivo (opcional)</label>
                        <select
                          id="cancel-motivo"
                          className="pagamento-modal__select"
                          value={cancelMotivo}
                          onChange={(e) => setCancelMotivo(e.target.value)}
                          disabled={cancelLoading}
                        >
                          <option value="">Selecione…</option>
                          <option value="caro">Achei caro</option>
                          <option value="pouco_uso">Uso pouco</option>
                          <option value="faltou_recurso">Faltou um recurso</option>
                          <option value="problema_tecnico">Tive problemas técnicos</option>
                          <option value="outro">Outro motivo</option>
                        </select>
                      </div>

                      {cancelError ? <p className="pagamento-modal__error">{cancelError}</p> : null}
                      <div className="pagamento-modal__actions">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setCancelModalOpen(false)}
                          disabled={cancelLoading}
                        >
                          Continuar assinante
                        </button>
                        <button
                          type="button"
                          className="btn-danger-ghost"
                          onClick={handleCancelarAssinatura}
                          disabled={cancelLoading}
                        >
                          {cancelLoading ? 'Cancelando…' : 'Cancelar mesmo assim'}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                ) : null}

                {isentaOrientacaoAbaixoHistorico ? (
                  <PagamentoOrientacaoCard
                    variant={orientacao.variant}
                    title={orientacao.title}
                    body={orientacao.body}
                  />
                ) : null}
              </div>

              {!isentaOrientacaoAbaixoHistorico &&
              painelAssinatura.situacao !== 'trial' &&
              !(painelAssinatura.situacao === 'ativo' && painelAssinatura.paga) ? (
                <PagamentoPainelLateral orientacao={orientacao} />
              ) : null}
            </div>

            <PagamentoPixQrModal
              open={pixModalOpen}
              onClose={() => setPixModalOpen(false)}
              loading={pixLoading}
              error={pixError}
              needsCpf={pixNeedsCpf}
              cpfCnpj={pixCpfCnpj}
              onCpfCnpjChange={setPixCpfCnpj}
              pixData={pixData}
              onGerar={handleGerarPixQrAnual}
            />
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
