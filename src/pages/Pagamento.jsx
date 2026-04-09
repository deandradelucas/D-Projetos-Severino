import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import MpStatusBadge from '../components/MpStatusBadge'
import { apiUrl } from '../lib/apiUrl'
import './dashboard.css'

function statusLabel(status) {
  if (!status) return '—'
  const s = String(status).toLowerCase()
  if (s === 'approved' || s === 'authorized') return 'Aprovado'
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') return 'Pendente'
  if (s === 'rejected' || s === 'cancelled' || s === 'refunded' || s === 'charged_back') return 'Recusado / estornado'
  return status
}

function situacaoAssinaturaLabel(code) {
  const m = {
    admin: 'Administrador',
    isento: 'Conta isenta de pagamento',
    trial: 'Período de teste',
    ativo: 'Assinatura ativa',
    pausada: 'Assinatura pausada no Mercado Pago',
    cancelada: 'Assinatura cancelada no Mercado Pago',
    inativa: 'Sem assinatura ativa',
  }
  return m[code] || ''
}

function painelAssinaturaFromUser(u) {
  if (!u) {
    return { situacao: null, label: '', mpUrl: '', bloqueada: false, motivo: '' }
  }
  const code = u.assinatura_situacao
  return {
    situacao: code != null ? String(code) : null,
    label: code ? situacaoAssinaturaLabel(String(code)) : '',
    mpUrl: typeof u.mp_gerenciar_url === 'string' ? u.mp_gerenciar_url.trim() : '',
    bloqueada: !!u.assinatura_mp_bloqueada,
    motivo: typeof u.motivo_bloqueio_acesso === 'string' ? u.motivo_bloqueio_acesso : '',
  }
}

export default function Pagamento() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [config, setConfig] = useState({ ready: false, publicKey: null, isento_pagamento: false })
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [valor] = useState('10.00')
  const [titulo] = useState('Assinatura mensal Horizonte Financeiro')
  const [proximaCobranca, setProximaCobranca] = useState(null)
  const [precoMensal, setPrecoMensal] = useState(10)
  const [painelAssinatura, setPainelAssinatura] = useState(() => painelAssinaturaFromUser(null))

  const statusUrl = searchParams.get('status')
  const mpSub = searchParams.get('mp')
  const expirado = searchParams.get('expirado') === '1'

  useEffect(() => {
    const load = async () => {
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
            if (!uidHistorico) return { ok: false }
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
        }

        if (histRes.ok) {
          const h = await histRes.json()
          setHistorico(Array.isArray(h) ? h : [])
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
        body: JSON.stringify({ valor: v, titulo: titulo.trim() || 'Assinatura mensal Horizonte Financeiro' }),
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

  return (
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <MobileMenuButton onClick={() => setMenuAberto(true)} />
            <div>
              <h1 className="responsive-h1" style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Pagamento
              </h1>
              <p className="responsive-p" style={{ color: 'var(--text-secondary)' }}>
                Assinatura mensal de <strong>R$ {precoMensal.toFixed(2).replace('.', ',')}</strong> — cobrança automática todo mês no cartão; o valor cai na conta Mercado Pago do aplicativo. Você autoriza uma vez no checkout do MP.
              </p>
            </div>
          </div>
        </header>

        {expirado && (
          <div
            className="content-section"
            style={{
              marginBottom: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Seu período de teste terminou ou a assinatura não está ativa.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Conclua o pagamento abaixo pelo Mercado Pago para voltar a usar o aplicativo. Após a aprovação, atualize a
              página ou faça login novamente.
            </p>
          </div>
        )}

        {statusUrl && (
          <div
            className="content-section"
            style={{
              marginBottom: '16px',
              padding: '14px 16px',
              borderRadius: '12px',
              background:
                statusUrl === 'success'
                  ? 'rgba(34,197,94,0.12)'
                  : statusUrl === 'pending'
                    ? 'rgba(234,179,8,0.12)'
                    : 'rgba(239,68,68,0.12)',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              {statusUrl === 'success' && 'Pagamento concluído ou em análise. O status final aparece em alguns instantes no histórico abaixo.'}
              {statusUrl === 'pending' && 'Pagamento pendente (ex.: boleto ou análise). Você receberá a confirmação pelo Mercado Pago.'}
              {statusUrl === 'failure' && 'Não foi possível concluir o pagamento. Tente outro meio ou tente novamente.'}
            </p>
            <button type="button" className="btn-secondary" style={{ marginTop: '10px', padding: '6px 12px', fontSize: '12px' }} onClick={limparStatusUrl}>
              Fechar aviso
            </button>
          </div>
        )}

        {!loading &&
          (painelAssinatura.label || proximaCobranca || painelAssinatura.mpUrl || painelAssinatura.bloqueada) && (
          <section className="content-section pagamento-assinatura-panel" style={{ gridColumn: '1 / -1', maxWidth: '520px' }} aria-labelledby="pagamento-assinatura-heading">
            <h2 id="pagamento-assinatura-heading" className="pagamento-assinatura-panel__title">
              Status da assinatura
            </h2>
            {painelAssinatura.label ? (
              <p className="pagamento-assinatura-panel__status">{painelAssinatura.label}</p>
            ) : null}
            {painelAssinatura.bloqueada && painelAssinatura.motivo ? (
              <p className="pagamento-assinatura-panel__alert">{painelAssinatura.motivo}</p>
            ) : null}
            {proximaCobranca ? (
              <div className="pagamento-assinatura-panel__cobranca">
                <div className="pagamento-assinatura-panel__cobranca-label">Próxima cobrança</div>
                <div className="pagamento-assinatura-panel__cobranca-data">
                  {new Date(proximaCobranca).toLocaleString('pt-BR', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Data informada pelo Mercado Pago após a autorização da assinatura. Atualiza automaticamente após cada pagamento.
                </p>
              </div>
            ) : null}
            {painelAssinatura.mpUrl ? (
              <a
                className="pagamento-assinatura-panel__link"
                href={painelAssinatura.mpUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Gerenciar no Mercado Pago
              </a>
            ) : null}
          </section>
        )}

        <section className="content-section" style={{ gridColumn: '1 / -1', maxWidth: '520px' }}>
          {!config.ready && !loading && (
            <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '12px' }}>
              Pagamentos ainda não estão ativos: configure <code>MERCADO_PAGO_ACCESS_TOKEN</code> no servidor (e rode a migration da tabela{' '}
              <code>pagamentos_mercadopago</code>).
            </p>
          )}

          {config.isento_pagamento && !loading && (
            <div
              style={{
                marginBottom: '16px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.25)',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Sua conta está isenta de pagamento.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Não é necessário concluir o checkout do Mercado Pago. Em caso de dúvida, fale com o suporte.
              </p>
            </div>
          )}

          <div
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(148,163,184,0.25)',
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          >
            <strong>{titulo}</strong>
            <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Valor: <strong style={{ color: 'var(--text-primary)' }}>R$ {precoMensal.toFixed(2).replace('.', ',')} / mês</strong>
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}

          <button
            type="button"
            className="btn-primary"
            disabled={!config.ready || paying || loading || config.isento_pagamento}
            onClick={handlePagar}
            style={{ padding: '12px 20px' }}
          >
            {paying ? 'Redirecionando…' : 'Assinar e autorizar no Mercado Pago'}
          </button>

          {config.publicKey && (
            <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>Chave pública MP carregada para futuras integrações (Wallet / Brick).</p>
          )}
        </section>

        <section className="content-section" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Histórico</h2>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
          ) : historico.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum pagamento registrado ainda.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td>
                        {row.amount != null ? `R$ ${Number(row.amount).toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <MpStatusBadge status={row.status} label={statusLabel(row.status)} />
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px' }}>
                        {row.status_detail || row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
