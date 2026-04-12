import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import PagamentoResumoKpis from '../components/pagamento/PagamentoResumoKpis.jsx'
import PagamentoPainelLateral from '../components/pagamento/PagamentoPainelLateral.jsx'
import PagamentoDetalhesCard from '../components/pagamento/PagamentoDetalhesCard.jsx'
import PagamentoHistorico from '../components/pagamento/PagamentoHistorico.jsx'
import { apiUrl } from '../lib/apiUrl'
import { formatCurrencyBRL } from '../lib/formatCurrency'
import {
  PLANO_PADRAO_TITULO,
  buildOrientacaoUsuario,
  buildResumoKpis,
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

  const onVerHistorico = () => {
    historicoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const ultimo = ultimoPagamentoHistorico(historico)
  const primeiroRegistroIso = historico.length ? historico[historico.length - 1]?.created_at : null

  const resumoItems = buildResumoKpis({
    painel: painelAssinatura,
    proximaCobranca,
    precoMensal,
    tituloPlano: titulo,
    historico,
  })

  const orientacao = buildOrientacaoUsuario({
    painel: painelAssinatura,
    configReady: config.ready,
    isento: config.isento_pagamento,
    historicoLen: historico.length,
  })

  return (
    <div className="dashboard-container page-pagamento app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner">
            <header className="ref-dashboard-header page-pagamento-header">
              <MobileMenuButton onClick={() => setMenuAberto(true)} />
              <div className="ref-dashboard-header__lead">
                <h1 className="ref-dashboard-greeting">
                  <span className="ref-dashboard-greeting__name">Pagamento</span>
                </h1>
                <p className="ref-panel__subtitle page-pagamento-header-sub">
                  Gerencie sua assinatura, cobranças e histórico de pagamentos no Mercado Pago.
                </p>
              </div>
            </header>

            <div className="page-pagamento-layout">
              <div className="page-pagamento-layout__primary">
                {dadosErro ? (
                  <div className="pagamento-banner pagamento-banner--danger" role="alert">
                    <p className="pagamento-banner__title">{dadosErro}</p>
                  </div>
                ) : null}

                {expirado ? (
                  <div className="pagamento-banner pagamento-banner--danger" role="alert">
                    <p className="pagamento-banner__title">Seu período de teste terminou ou a assinatura não está ativa.</p>
                    <p className="pagamento-banner__text">
                      Conclua o pagamento pelo Mercado Pago para voltar a usar o aplicativo. Após a aprovação, use &quot;Atualizar status&quot; ou faça login
                      novamente.
                    </p>
                  </div>
                ) : null}

                {statusUrl ? (
                  <div className={pagamentoStatusBannerClass(statusUrl)} role="status">
                    <p className="pagamento-banner__title">
                      {statusUrl === 'success'
                        ? 'Pagamento concluído ou em análise. O status final aparece em instantes no histórico abaixo.'
                        : statusUrl === 'pending'
                          ? 'Pagamento pendente (ex.: boleto ou análise). Você receberá a confirmação pelo Mercado Pago.'
                          : 'Não foi possível concluir o pagamento. Tente outro meio ou tente novamente.'}
                    </p>
                    <button type="button" className="btn-secondary btn-secondary--compact" onClick={limparStatusUrl}>
                      Fechar aviso
                    </button>
                  </div>
                ) : null}

                {!config.ready && !loading ? (
                  <p className="pagamento-config-alert">
                    Pagamentos ainda não estão ativos: configure <code>MERCADO_PAGO_ACCESS_TOKEN</code> no servidor (e rode a migration da tabela{' '}
                    <code>pagamentos_mercadopago</code>).
                  </p>
                ) : null}

                {config.isento_pagamento && !loading ? (
                  <div className="pagamento-banner pagamento-banner--success">
                    <p className="pagamento-banner__title">Sua conta está isenta de pagamento.</p>
                    <p className="pagamento-banner__text">Não é necessário concluir o checkout do Mercado Pago. Em caso de dúvida, fale com o suporte.</p>
                  </div>
                ) : null}

                <PagamentoResumoKpis items={resumoItems} />

                <PagamentoDetalhesCard
                  tituloPlano={titulo}
                  precoMensal={precoMensal}
                  painel={painelAssinatura}
                  proximaCobranca={proximaCobranca}
                  primeiroRegistroIso={primeiroRegistroIso}
                  formatCurrency={formatCurrency}
                />

                {painelAssinatura.bloqueada && painelAssinatura.motivo ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__title">Atenção ao acesso</p>
                    <p className="pagamento-banner__text">{painelAssinatura.motivo}</p>
                  </div>
                ) : null}

                {ultimo && (ultimo.status === 'rejected' || ultimo.status === 'cancelled' || ultimo.status === 'refunded') ? (
                  <div className="pagamento-banner pagamento-banner--warning" role="status">
                    <p className="pagamento-banner__title">Última cobrança: {formatCurrency(Number(ultimo.amount || 0))}</p>
                    <p className="pagamento-banner__text">
                      Status recente no histórico indica necessidade de revisão. Atualize o meio de pagamento no Mercado Pago ou tente autorizar novamente.
                    </p>
                  </div>
                ) : null}

                <PagamentoHistorico historicoRef={historicoRef} historico={historico} loading={loading} formatCurrency={formatCurrency} />
              </div>

              <PagamentoPainelLateral
                orientacao={orientacao}
                onAssinar={handlePagar}
                onAtualizar={onAtualizar}
                onVerHistorico={onVerHistorico}
                paying={paying}
                loading={loading}
                configReady={config.ready}
                isento={config.isento_pagamento}
                mpUrl={painelAssinatura.mpUrl}
                disabledAssinar={!config.ready || paying || loading || config.isento_pagamento}
                checkoutError={error}
                mpHint={config.publicKey ? 'Integração Mercado Pago pronta (checkout pré-aprovado).' : null}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
