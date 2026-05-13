import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { maskCpfCnpj, validateCpfCnpj } from '../lib/cpfCnpjUtils.js'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  PLANO_PADRAO_TITULO,
  buildOrientacaoUsuario,
  painelAssinaturaFromUser,
  ultimoPagamentoHistorico,
} from '../lib/pagamentoPageModel.js'
import './dashboard.css'

function pagamentoStatusBannerClass(statusUrl) {
  if (statusUrl === 'success') return 'pagamento-banner pagamento-banner--success'
  if (statusUrl === 'pending') return 'pagamento-banner pagamento-banner--warning'
  return 'pagamento-banner pagamento-banner--danger'
}

/** Cobrança ainda pode mudar de estado no Asaas — vale continuar a sincronizar. */
function pagamentoHistoricoStatusPendente(status) {
  if (status == null || String(status).trim() === '') return false
  const s = String(status).toLowerCase()
  return s === 'pending' || s === 'in_process' || s === 'awaiting_risk_analysis'
}

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
  const [planoCheckout, setPlanoCheckout] = useState(() => /** @type {'mensal' | 'anual'} */ ('mensal'))
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

  useEffect(() => {
    const saved = localStorage.getItem('horizonte_cpf_cnpj')
    if (saved) setCpfCnpj(saved)
  }, [])

  const statusUrl = searchParams.get('status')
  const asaasCb = searchParams.get('asaas')
  const stripeCb = searchParams.get('stripe')
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
      const cfgHeaders = uid ? { 'x-user-id': uid } : {}

      if (uid && u) {
        setPainelAssinatura(painelAssinaturaFromUser(u))
        if (u.assinatura_proxima_cobranca) setProximaCobranca(u.assinatura_proxima_cobranca)
        try {
          const stRes = await fetch(apiUrl('/api/assinatura/status'), {
            headers: { 'x-user-id': uid },
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
        fetch(apiUrl('/api/pagamentos/config'), { headers: cfgHeaders }),
        (async () => {
          if (!uidHistorico) return { ok: false, status: 0 }
          return fetch(apiUrl('/api/pagamentos/minhas'), {
            headers: { 'x-user-id': uidHistorico },
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

  const descontoAnual = useMemo(() => {
    const base = precosCatalogo.mensal * 12
    if (base <= 0 || precosCatalogo.anual >= base) return 0
    return Math.round((1 - precosCatalogo.anual / base) * 100)
  }, [precosCatalogo])

  /**
   * Volta do checkout / cobrança pendente: sincroniza de pouco em pouco (aba visível), sem piscar o skeleton.
   * Para quando a assinatura fica ativa, a conta é isenta, o último registro deixa de estar pendente, ou esgota o tempo máximo.
   */
  useEffect(() => {
    const checkoutOk = asaasCb === 'ok' || stripeCb === 'ok'
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
          if (checkoutOk) {
            next.delete('asaas')
            next.delete('stripe')
          }
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
    stripeCb,
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
      const u = JSON.parse(userSaved)

      const res = await fetch(apiUrl('/api/pagamentos/preferencia'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
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
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/pagamentos/asaas/pix-anual-qrcode'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
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
  const orientacao = buildOrientacaoUsuario({
    painel: painelAssinatura,
    configReady: config.ready,
    isento: config.isento_pagamento,
    historicoLen: historico.length,
  })

  /** Card “Conta isenta” na coluna direita vira bloco abaixo do histórico (exceto conta admin). */
  const isentaOrientacaoAbaixoHistorico =
    config.isento_pagamento && painelAssinatura.situacao !== 'admin'

  const valorCicloSelecionado = planoCheckout === 'anual' ? precosCatalogo.anual : precosCatalogo.mensal
  const unidadeCiclo = planoCheckout === 'anual' ? 'ano' : 'mês'

  const assinarLabelCheckout =
    planoCheckout === 'anual'
      ? `Pagar ${formatCurrency(precosCatalogo.anual)} / ano com cartão`
      : `Pagar ${formatCurrency(precosCatalogo.mensal)} / mês com cartão`

  const disabledCheckout = !config.ready || paying || loading || config.isento_pagamento

  const meiosDetalhes =
    planoCheckout === 'anual'
      ? 'Pix ou cartão de crédito no checkout Asaas'
      : 'Cartão de crédito no checkout Asaas'

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
                  <h1 className="dashboard-hub__title">Pagamento</h1>
                  <p className="ref-panel__subtitle page-pagamento-header-sub">
                    Plano, assinatura e histórico de cobranças
                  </p>
                </div>
              </div>
            </section>

            <div
              className={`page-pagamento-layout${isentaOrientacaoAbaixoHistorico ? ' page-pagamento-layout--sem-lateral' : ''}`}
            >
              <div className="page-pagamento-layout__primary">
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

                {stripeCb === 'cancel' ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__title">Checkout Stripe cancelado. Você pode tentar de novo quando quiser.</p>
                    <button
                      type="button"
                      className="btn-secondary btn-secondary--compact"
                      onClick={() => fecharParamCheckout('stripe')}
                    >
                      Fechar aviso
                    </button>
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
                  <div className={pagamentoStatusBannerClass(statusUrl)} role="status">
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
                  <div className="ref-panel page-pagamento-planos" role="radiogroup" aria-label="Plano de assinatura">
                    <p className="page-pagamento-planos__legend">Escolha o plano</p>
                    <div className="page-pagamento-planos__grid">
                      <button
                        type="button"
                        className={`page-pagamento-planos__option${planoCheckout === 'mensal' ? ' page-pagamento-planos__option--active' : ''}`}
                        role="radio"
                        aria-checked={planoCheckout === 'mensal'}
                        onClick={() => setPlanoCheckout('mensal')}
                      >
                        <span className="page-pagamento-planos__option-title">Mensal</span>
                        <span className="page-pagamento-planos__option-price">{formatCurrency(precosCatalogo.mensal)} / mês</span>
                        <span className="page-pagamento-planos__option-hint">Cobrança mensal no cartão</span>
                      </button>
                      <button
                        type="button"
                        className={`page-pagamento-planos__option${planoCheckout === 'anual' ? ' page-pagamento-planos__option--active' : ''}`}
                        role="radio"
                        aria-checked={planoCheckout === 'anual'}
                        onClick={() => setPlanoCheckout('anual')}
                      >
                        <span className="page-pagamento-planos__option-title">
                          Anual
                          {descontoAnual > 0 ? (
                            <span className="page-pagamento-planos__badge">-{descontoAnual}%</span>
                          ) : null}
                        </span>
                        <span className="page-pagamento-planos__option-price">{formatCurrency(precosCatalogo.anual)} / ano</span>
                        <span className="page-pagamento-planos__option-hint">Cobrança anual no cartão</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {!config.isento_pagamento && config.ready && !loading ? (
                  <div className="ref-panel pagamento-checkout-panel">
                    <div className="pagamento-checkout-panel__lead">
                      <p className="pagamento-checkout-panel__lead-title">Finalizar assinatura</p>
                      <p className="pagamento-checkout-panel__lead-text">
                        Você será redirecionado para o checkout seguro da Asaas para inserir os dados do cartão.
                      </p>
                    </div>

                    <div className="pagamento-checkout-panel__field">
                      <label htmlFor="cpf-checkout" className="pagamento-checkout-panel__label">
                        CPF ou CNPJ <span className="pagamento-checkout-panel__label-req">*</span>
                      </label>
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
                      />
                      <p className="pagamento-checkout-panel__hint">Exigido pela Asaas para identificar o pagador.</p>
                    </div>

                    {error ? <p className="pagamento-checkout-panel__error">{error}</p> : null}

                    <button
                      type="button"
                      className="btn-primary pagamento-checkout-panel__btn-full"
                      disabled={disabledCheckout || paying}
                      onClick={handlePagarAsaas}
                    >
                      {paying ? 'Redirecionando para Asaas…' : assinarLabelCheckout}
                    </button>

                    <button
                      type="button"
                      className="btn-secondary pagamento-checkout-panel__btn-full"
                      disabled={loading || paying}
                      onClick={onAtualizar}
                    >
                      Atualizar status
                    </button>

                    {planoCheckout === 'anual' ? (
                      <button
                        type="button"
                        className="btn-secondary pagamento-checkout-panel__btn-full"
                        disabled={paying || loading}
                        onClick={() => {
                          setPixCpfCnpj(cpfCnpj.replace(/\D/g, ''))
                          setPixModalOpen(true)
                        }}
                      >
                        Pagar com Pix (plano anual, à vista)
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {config.isento_pagamento && !loading ? (
                  <div className="pagamento-banner pagamento-banner--success">
                    <p className="pagamento-banner__title">Conta isenta — sem cobrança.</p>
                  </div>
                ) : null}

                <PagamentoDetalhesCard
                  tituloPlano={titulo}
                  valorCicloSelecionado={valorCicloSelecionado}
                  unidadeCiclo={unidadeCiclo}
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

                {isentaOrientacaoAbaixoHistorico ? (
                  <PagamentoOrientacaoCard
                    variant={orientacao.variant}
                    title={orientacao.title}
                    body={orientacao.body}
                  />
                ) : null}
              </div>

              {!isentaOrientacaoAbaixoHistorico ? <PagamentoPainelLateral orientacao={orientacao} /> : null}
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
