import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '@components/Sidebar'
import MobileMenuButton from '@components/MobileMenuButton'
import RefDashboardScroll from '@components/RefDashboardScroll'
import PagamentoPainelLateral from '@features/pagamentos/components/PagamentoPainelLateral.jsx'
import PagamentoDetalhesCard from '@features/pagamentos/components/PagamentoDetalhesCard.jsx'
import PagamentoHistorico from '@features/pagamentos/components/PagamentoHistorico.jsx'
import { apiUrl } from '@shared/api'
import { formatCurrencyBRL } from '@shared/format'
import {
  PLANO_PADRAO_TITULO,
  buildOrientacaoUsuario,
  painelAssinaturaFromUser,
  ultimoPagamentoHistorico,
} from '@features/pagamentos/model/pagamentoPageModel.js'
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

  const [config, setConfig] = useState({ ready: false, publicKey: null, isento_pagamento: false })
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [dadosErro, setDadosErro] = useState('')
  const [valor] = useState('10.00')
  const [titulo] = useState(PLANO_PADRAO_TITULO)
  const [proximaCobranca, setProximaCobranca] = useState(null)
  const [precoMensal, setPrecoMensal] = useState(10)
  const [painelAssinatura, setPainelAssinatura] = useState(() => painelAssinaturaFromUser(null))

  const statusUrl = searchParams.get('status')
  const mpSub = searchParams.get('mp')
  const expirado = searchParams.get('expirado') === '1'

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
        if (u.plano_preco_mensal != null) {
          const p = Number(u.plano_preco_mensal)
          if (Number.isFinite(p) && p > 0) setPrecoMensal(p)
        }
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
            if (assinatura.plano_preco_mensal != null) {
              const p = Number(assinatura.plano_preco_mensal)
              if (Number.isFinite(p) && p > 0) setPrecoMensal(p)
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
    if (mpSub !== 'sub_ok') return
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
            if (assinatura.plano_preco_mensal != null) {
              const p = Number(assinatura.plano_preco_mensal)
              if (Number.isFinite(p) && p > 0) setPrecoMensal(p)
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
            next.delete('mp')
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
  }, [mpSub, setSearchParams])

  const handlePagar = async () => {
    setError('')
    setPaying(true)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        window.location.href = '/login'
        return
      }
      const u = JSON.parse(userSaved)
      const v = Number(String(valor).replace(',', '.'))
      if (!Number.isFinite(v) || v <= 0) {
        setError('Informe um valor válido.')
        setPaying(false)
        return
      }

      const res = await fetch(apiUrl('/api/pagamentos/preferencia'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
        body: JSON.stringify({ valor: v, titulo: titulo.trim() || PLANO_PADRAO_TITULO }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Não foi possível iniciar o pagamento.')

      const urlCheckout = data.use_sandbox ? data.sandbox_init_point : data.init_point
      if (!urlCheckout) throw new Error('URL de checkout indisponível.')
      window.location.href = urlCheckout
    } catch (e) {
      setError(e.message || 'Erro ao redirecionar para o Mercado Pago.')
    } finally {
      setPaying(false)
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

  return (
    <div className="dashboard-container page-pagamento ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
            <section className="dashboard-hub__hero page-pagamento-header" aria-label="Pagamento">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto(true)} />
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
                    <p className="pagamento-banner__text">Conclua o pagamento no Mercado Pago e use &quot;Atualizar status&quot;.</p>
                  </div>
                ) : null}

                {statusUrl ? (
                  <div className={pagamentoStatusBannerClass(statusUrl)} role="status">
                    <p className="pagamento-banner__title">
                      {statusUrl === 'success'
                        ? 'Pagamento recebido — o status atualiza em instantes no histórico.'
                        : statusUrl === 'pending'
                          ? 'Pagamento pendente. A confirmação vem pelo Mercado Pago.'
                          : 'Não foi possível concluir. Tente outro meio ou novamente.'}
                    </p>
                    <button type="button" className="btn-secondary btn-secondary--compact" onClick={limparStatusUrl}>
                      Fechar aviso
                    </button>
                  </div>
                ) : null}

                {!config.ready && !loading ? (
                  <p className="pagamento-config-alert">
                    Checkout indisponível: configure <code>MERCADO_PAGO_ACCESS_TOKEN</code> no servidor.
                  </p>
                ) : null}

                {config.isento_pagamento && !loading ? (
                  <div className="pagamento-banner pagamento-banner--success">
                    <p className="pagamento-banner__title">Conta isenta — sem cobrança.</p>
                  </div>
                ) : null}

                <PagamentoDetalhesCard
                  tituloPlano={titulo}
                  precoMensal={precoMensal}
                  painel={painelAssinatura}
                  proximaCobranca={proximaCobranca}
                  formatCurrency={formatCurrency}
                />

                {ultimo && (ultimo.status === 'rejected' || ultimo.status === 'cancelled' || ultimo.status === 'refunded') ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__text">
                      Última cobrança ({formatCurrency(Number(ultimo.amount || 0))}) não foi concluída. Atualize o cartão ou o meio de pagamento no Mercado Pago.
                    </p>
                  </div>
                ) : null}

                <PagamentoHistorico historicoRef={historicoRef} historico={historico} loading={loading} formatCurrency={formatCurrency} />
              </div>

              <PagamentoPainelLateral
                orientacao={orientacao}
                onAssinar={handlePagar}
                onAtualizar={onAtualizar}
                paying={paying}
                loading={loading}
                configReady={config.ready}
                isento={config.isento_pagamento}
                mpUrl={painelAssinatura.mpUrl}
                disabledAssinar={!config.ready || paying || loading || config.isento_pagamento}
                checkoutError={error}
              />
            </div>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}
