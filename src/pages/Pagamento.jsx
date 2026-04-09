import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
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

export default function Pagamento() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [config, setConfig] = useState({ ready: false, publicKey: null, isento_pagamento: false })
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [valor, setValor] = useState('10.00')
  const [titulo, setTitulo] = useState('Assinatura Horizonte Financeiro')

  const statusUrl = searchParams.get('status')

  useEffect(() => {
    const load = async () => {
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        let uid = ''
        try {
          uid = userSaved ? JSON.parse(userSaved).id : ''
        } catch {
          uid = ''
        }
        const cfgHeaders = uid ? { 'x-user-id': uid } : {}

        const [cfgRes, histRes] = await Promise.all([
          fetch(apiUrl('/api/pagamentos/config'), { headers: cfgHeaders }),
          (async () => {
            if (!userSaved) return { ok: false }
            const u = JSON.parse(userSaved)
            return fetch(apiUrl('/api/pagamentos/minhas'), { headers: { 'x-user-id': u.id } })
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
        body: JSON.stringify({ valor: v, titulo: titulo.trim() || 'Assinatura Horizonte Financeiro' }),
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
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
            <div>
              <h1 className="responsive-h1" style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Pagamento
              </h1>
              <p className="responsive-p" style={{ color: 'var(--text-secondary)' }}>
                Checkout seguro via Mercado Pago (cartão, Pix e outros meios disponíveis na sua conta MP).
              </p>
            </div>
          </div>
        </header>

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

          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Descrição</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={!config.ready || paying || config.isento_pagamento}
            style={{
              width: '100%',
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />

          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Valor (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={!config.ready || paying || config.isento_pagamento}
            style={{
              width: '100%',
              maxWidth: '200px',
              marginBottom: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}

          <button
            type="button"
            className="btn-primary"
            disabled={!config.ready || paying || loading || config.isento_pagamento}
            onClick={handlePagar}
            style={{ padding: '12px 20px' }}
          >
            {paying ? 'Redirecionando…' : 'Pagar com Mercado Pago'}
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
                      <td>{statusLabel(row.status)}</td>
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
