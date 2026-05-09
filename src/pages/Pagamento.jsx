import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '@components/Sidebar'
import MobileMenuButton from '@components/MobileMenuButton'
import RefDashboardScroll from '@components/RefDashboardScroll'
import PagamentoPainelLateral from '../components/pagamento/PagamentoPainelLateral.jsx'
import PagamentoDetalhesCard from '../components/pagamento/PagamentoDetalhesCard.jsx'
import PagamentoHistorico from '../components/pagamento/PagamentoHistorico.jsx'
import PagamentoPixQrModal from '../components/pagamento/PagamentoPixQrModal.jsx'
import { apiUrl } from '../lib/apiUrl'
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

export default function Pagamento() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const historicoRef = useRef(null)

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

  const statusUrl = searchParams.get('status')
  const asaasCb = searchParams.get('asaas')
  const stripeCb = searchParams.get('stripe')
  const expirado = searchParams.get('expirado') === '1' || asaasCb === 'expirado'

  const formatCurrency = formatCurrencyBRL

  const fetchDados = useCallback(async () => {
    setDadosErro('')
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
          const stRes = await fetch(apiUrl('/api/assinatura/status'), { headers: { 'x-user-id': uid } })
          if (stRes.ok) {
            const assinatura = await stRes.json()
            const merged = { ...u, ...assinatura }
            localStorage.setItem('horizonte_user', JSON.stringify(merged))
            window.dispatchEvent(new Event('horizonte-session-refresh'))
            setPainelAssinatura(painelAssinaturaFromUser(merged))
            if (assinatura.assinatura_proxima_cobranca) {
              setProximaCobranca(assinatura.assinatura_proxima_cobranca)
            }
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
          return fetch(apiUrl('/api/pagamentos/minhas'), { headers: { 'x-user-id': uidHistorico } })
        })(),
      ])

      if (cfgRes.ok) {
        const c = await cfgRes.json()
        setConfig({
          ready: !!c.ready,
          publicKey: c.publicKey,
          isento_pagamento: !!c.isento_pagamento,
        })
        const pm = Number(c.preco_mensal)
        const pa = Number(c.preco_anual)
        setPrecosCatalogo({
          mensal: Number.isFinite(pm) && pm > 0 ? pm : 10,
          anual: Number.isFinite(pa) && pa > 0 ? pa : 100,
        })
      } else {
        setDadosErro((prev) => prev || 'Não foi possível carregar a configuração de pagamentos.')
      }

      if (histRes.ok) {
        const h = await histRes.json()
        setHistorico(Array.isArray(h) ? h : [])
      } else if (uidHistorico) {
        setDadosErro((prev) => prev || 'Não foi possível carregar o histórico de cobranças.')
      }
    } catch {
      setDadosErro('Erro de rede ao carregar a página. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDados()
  }, [fetchDados])

  useEffect(() => {
    const okAsaas = asaasCb === 'ok'
    const okStripe = stripeCb === 'ok'
    if (!okAsaas && !okStripe) return
    let cancelled = false
    const sync = async () => {
      try {
        const raw = localStorage.getItem('horizonte_user')
        const u = raw ? JSON.parse(raw) : null
        if (!u?.id) return
        const stRes = await fetch(apiUrl('/api/assinatura/status'), { headers: { 'x-user-id': u.id }, cache: 'no-store' })
        if (stRes.ok) {
          const assinatura = await stRes.json()
          const merged = { ...u, ...assinatura }
          localStorage.setItem('horizonte_user', JSON.stringify(merged))
          window.dispatchEvent(new Event('horizonte-session-refresh'))
          if (!cancelled) {
            setPainelAssinatura(painelAssinaturaFromUser(merged))
            if (assinatura.assinatura_proxima_cobranca) {
              setProximaCobranca(assinatura.assinatura_proxima_cobranca)
            }
          }
        }
        const hRes = await fetch(apiUrl('/api/pagamentos/minhas'), { headers: { 'x-user-id': u.id }, cache: 'no-store' })
        if (hRes.ok && !cancelled) {
          const h = await hRes.json()
          setHistorico(Array.isArray(h) ? h : [])
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (okAsaas) next.delete('asaas')
            if (okStripe) next.delete('stripe')
            return next
          },
          { replace: true }
        )
      }
    }
    sync()
    return () => {
      cancelled = true
    }
  }, [asaasCb, stripeCb, setSearchParams])

  const handlePagarAsaas = async () => {
    setError('')
    if (!cpfCnpj.replace(/\D/g, '')) {
      setError('Informe seu CPF ou CNPJ para continuar.')
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

  const onAtualizar = async () => {
    setLoading(true)
    await fetchDados()
  }

  const ultimo = ultimoPagamentoHistorico(historico)
  const orientacao = buildOrientacaoUsuario({
    painel: painelAssinatura,
    configReady: config.ready,
    isento: config.isento_pagamento,
    historicoLen: historico.length,
  })

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

            <div className="page-pagamento-layout">
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
                      onClick={() => {
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            next.delete('stripe')
                            return next
                          },
                          { replace: true },
                        )
                      }}
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
                      onClick={() => {
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            next.delete('asaas')
                            return next
                          },
                          { replace: true },
                        )
                      }}
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

                {config.isento_pagamento && !loading ? (
                  <div className="pagamento-banner pagamento-banner--success">
                    <p className="pagamento-banner__title">Conta isenta — sem cobrança.</p>
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
                        <span className="page-pagamento-planos__option-title">Anual</span>
                        <span className="page-pagamento-planos__option-price">{formatCurrency(precosCatalogo.anual)} / ano</span>
                        <span className="page-pagamento-planos__option-hint">Cobrança anual no cartão</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {!config.isento_pagamento && config.ready && !loading ? (
                  <div className="ref-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                        Finalizar assinatura
                      </p>
                      <p style={{ fontSize: '0.85rem', opacity: 0.65 }}>
                        Você será redirecionado para o checkout seguro da Asaas para inserir os dados do cartão.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label htmlFor="cpf-checkout" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        CPF ou CNPJ <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        id="cpf-checkout"
                        type="text"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        placeholder="000.000.000-00"
                        maxLength={18}
                        disabled={paying}
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          border: '1.5px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <p style={{ fontSize: '0.8rem', opacity: 0.55 }}>
                        Exigido pela Asaas para identificar o pagador.
                      </p>
                    </div>

                    {error ? (
                      <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>
                    ) : null}

                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', fontSize: '1rem', padding: '0.75rem' }}
                      disabled={disabledCheckout || paying}
                      onClick={handlePagarAsaas}
                    >
                      {paying ? 'Redirecionando para Asaas…' : assinarLabelCheckout}
                    </button>
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
                      Última cobrança ({formatCurrency(Number(ultimo.amount || 0))}) não está em dia. Regularize no portal Asaas ou use
                      &quot;Atualizar status&quot;.
                    </p>
                  </div>
                ) : null}

                <PagamentoHistorico historicoRef={historicoRef} historico={historico} loading={loading} formatCurrency={formatCurrency} />
              </div>

              <PagamentoPainelLateral
                orientacao={orientacao}
                onAtualizar={onAtualizar}
                paying={paying}
                loading={loading}
                configReady={config.ready}
                isento={config.isento_pagamento}
                portalUrl={painelAssinatura.portalUrl}
              />
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
