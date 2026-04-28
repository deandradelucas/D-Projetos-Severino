import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import AdminDataTableSkeleton from '../components/AdminDataTableSkeleton'
import './dashboard.css'

const WHATSAPP_LOG_HEADERS = ['Data', 'Usuário', 'Telefone remetente', 'Mensagem dita', 'Status', 'Resultado / detalhe']

export default function AdminWhatsApp() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [whatsappConfig, setWhatsappConfig] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [status, setStatus] = useState({
    online: false,
    platform: 'Carregando...',
    lastPulse: null,
    totalLogs: 0,
  })

  const getStatusBadge = (st) => {
    switch (st) {
      case 'SUCESSO':
        return <span className="admin-wa-badge admin-wa-badge--ok">SUCESSO</span>
      case 'CONVERSA':
        return <span className="admin-wa-badge admin-wa-badge--conversa">CONVERSA</span>
      case 'IGNORADO':
        return <span className="admin-wa-badge admin-wa-badge--warn">IGNORADO</span>
      case 'ERRO':
        return <span className="admin-wa-badge admin-wa-badge--err">ERRO</span>
      default:
        return <span className="admin-wa-badge admin-wa-badge--muted">{st}</span>
    }
  }

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(label)
      setTimeout(() => setCopyFeedback(''), 2000)
    } catch {
      setCopyFeedback('Erro ao copiar')
    }
  }

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        if (!userSaved) return
        const u = JSON.parse(userSaved)
        const headers = { 'x-user-id': u.id }

        fetch('/api/admin/whatsapp-status', { headers })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
          .then((data) => setStatus(data))
          .catch((e) => console.error('Erro ao buscar status do WhatsApp:', e))

        const [resLogs, resCfg] = await Promise.all([
          fetch('/api/admin/whatsapp-logs', { headers }),
          fetch('/api/admin/whatsapp-config', { headers }),
        ])

        if (resCfg.ok) {
          const cfg = await resCfg.json()
          setWhatsappConfig(cfg)
        }

        if (!resLogs.ok) throw new Error('Falha ao carregar logs')
        const data = await resLogs.json()
        setLogs(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  return (
    <div className="dashboard-container page-admin ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
            <section className="dashboard-hub__hero page-admin__hero" aria-label="Logs do WhatsApp">
              <div className="dashboard-hub__hero-row">
                <MobileMenuButton onClick={() => setMenuAberto(true)} />
                <div className="dashboard-hub__hero-text">
                  <h1 className="dashboard-hub__title">WHATSAPP CORE v4</h1>
                  <p className="ref-panel__subtitle page-admin-header-sub">
                    Gestão de infraestrutura e fluxo de mensagens
                  </p>
                </div>
              </div>
            </section>

            <div className="page-admin-kpi-compact-strip" style={{ marginBottom: '16px' }}>
              <div className="kpi-mini">
                <span>Status:</span> 
                <strong style={{ color: status.online ? '#22c55e' : '#ef4444', fontSize: '12px' }}>
                  {status.online ? 'CONECTADO' : 'OFFLINE'}
                </strong>
              </div>
              <div className="kpi-mini"><span>Plataforma:</span> <strong>{status.platform}</strong></div>
              <div className="kpi-mini"><span>Mensagens:</span> <strong>{status.totalLogs}</strong></div>
              <div className="kpi-mini kpi-mini--accent"><span>Atividade:</span> <strong>{status.lastPulse ? new Date(status.lastPulse).toLocaleTimeString('pt-BR') : '—:—'}</strong></div>
            </div>

            {whatsappConfig && (
              <article className="ref-panel page-admin-ref-panel" aria-labelledby="wa-webhook-heading">
                <div className="ref-panel__head">
                  <div>
                    <h2 id="wa-webhook-heading" className="ref-panel__title">
                      URL do webhook (Evolution API)
                    </h2>
                    <p className="ref-panel__subtitle">
                      {whatsappConfig.hint} O número em <strong>Telefone remetente</strong> deve coincidir com o{' '}
                      <strong>telefone informado no cadastro da conta</strong> (criação de conta).
                    </p>
                  </div>
                </div>
                <div className="page-admin-webhook-body">
                  {whatsappConfig.missingToken || !whatsappConfig.webhookUrlQuery ? (
                    <p className="page-admin-error" role="alert">
                      {whatsappConfig.hint ||
                        'Defina WHATSAPP_WEBHOOK_TOKEN no servidor (ex.: Vercel) para gerar as URLs do webhook.'}
                    </p>
                  ) : (
                    <>
                      <div>
                        <p className="page-admin-webhook-label">Com ?token= (recomendado)</p>
                        <div className="page-admin-webhook-row">
                          <code className="page-admin-code">{whatsappConfig.webhookUrlQuery}</code>
                          <button
                            type="button"
                            className="btn-secondary page-admin-copy-btn"
                            onClick={() => copyText('query', whatsappConfig.webhookUrlQuery)}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="page-admin-webhook-label">Token no path (alternativa)</p>
                        <div className="page-admin-webhook-row">
                          <code className="page-admin-code">{whatsappConfig.webhookUrlPath}</code>
                          <button
                            type="button"
                            className="btn-secondary page-admin-copy-btn"
                            onClick={() => copyText('path', whatsappConfig.webhookUrlPath)}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {copyFeedback ? <p className="page-admin-copy-feedback">Copiado ({copyFeedback}).</p> : null}
                </div>
              </article>
            )}

            <article className="ref-panel page-admin-ref-panel page-admin-ref-panel--table" aria-labelledby="wa-logs-heading">
              <div className="ref-panel__head">
                <div>
                  <h2 id="wa-logs-heading" className="ref-panel__title">
                    Fluxo de Mensagens
                  </h2>
                  <p className="ref-panel__subtitle">Histórico auditado do bot</p>
                </div>
              </div>
              {error ? <div className="page-admin-error">{error}</div> : null}
              <div className="page-admin-table-scroll">
                {loading ? (
                  <AdminDataTableSkeleton headers={WHATSAPP_LOG_HEADERS} rows={8} />
                ) : logs.length === 0 ? (
                  <p className="page-admin-empty">Nenhuma mensagem processada ainda.</p>
                ) : (
                  <table className="data-table page-admin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Data</th>
                        <th>Usuário</th>
                        <th>Telefone remetente</th>
                        <th style={{ minWidth: '200px' }}>Mensagem dita</th>
                        <th>Status</th>
                        <th>Resultado / detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.data_hora ? new Date(log.data_hora).toLocaleString('pt-BR') : '—'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {log.usuarios ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px' }}>{log.usuarios.nome}</span>
                                <span style={{ fontSize: '10px', opacity: 0.7, fontWeight: 400 }}>{log.usuarios.email}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td>{log.telefone_remetente}</td>
                          <td className="page-admin-td-ellipsis" title={log.mensagem_recebida}>
                            {log.mensagem_recebida && /\[Áudio/i.test(String(log.mensagem_recebida)) ? (
                              <>
                                <span className="admin-wa-badge admin-wa-badge--warn" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }}>
                                  Áudio
                                </span>
                                {log.mensagem_recebida}
                              </>
                            ) : (
                              log.mensagem_recebida || '(vazio)'
                            )}
                          </td>
                          <td>{getStatusBadge(log.status)}</td>
                          <td className="page-admin-td-detail">{log.detalhe_erro || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </article>
            </RefDashboardScroll>
          </div>
        </main>
      </div>
    </div>
  )
}

