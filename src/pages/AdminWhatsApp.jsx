import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import './dashboard.css'

export default function AdminWhatsApp() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [whatsappConfig, setWhatsappConfig] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [status, setStatus] = useState({
    online: false,
    platform: 'Carregando...',
    lastPulse: null,
    totalLogs: 0
  })

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCESSO':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#16a34a' }}>SUCESSO</span>
      case 'IGNORADO':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }}>IGNORADO</span>
      case 'ERRO':
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}>ERRO</span>
      default:
        return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(100, 100, 100, 0.1)', color: '#666' }}>{status}</span>
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
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        if (!userSaved) return // No user
        const u = JSON.parse(userSaved)
        const headers = { 'x-user-id': u.id }

        fetch('/api/admin/whatsapp-status', { headers })
          .then(r => r.json())
          .then(data => setStatus(data))
          .catch(e => console.error('Erro ao buscar status:', e))

        const [resLogs, resCfg, resUsers] = await Promise.all([
          fetch('/api/admin/whatsapp-logs', { headers }),
          fetch('/api/admin/whatsapp-config', { headers }),
          fetch('/api/admin/usuarios', { headers }),
        ])

        if (resCfg.ok) {
          const cfg = await resCfg.json()
          setWhatsappConfig(cfg)
        }

        if (resUsers.ok) {
          const list = await resUsers.json()
          setUsuarios(Array.isArray(list) ? list : [])
        }
        setLoadingUsuarios(false)

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
    <div className="dashboard-container">
      <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />
      
      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="mobile-menu-btn" onClick={() => setMenuAberto(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="7" x="3" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="3" rx="1"/>
                <rect width="7" height="7" x="14" y="14" rx="1"/>
                <rect width="7" height="7" x="3" y="14" rx="1"/>
              </svg>
            </button>
            <div>
              <h1 className="responsive-h1" style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>Logs do WhatsApp</h1>
              <p className="responsive-p" style={{ color: 'var(--text-secondary)' }}>Auditoria de mensagens recebidas pelo BOT</p>
            </div>
          </div>
        </header>

        <section className="content-section" style={{ gridColumn: '1 / -1', marginBottom: '24px', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {/* Card Status Webhook */}
            <div className="kpi-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Integração</p>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{status.platform}</h3>
                </div>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: status.online ? '#22c55e' : '#ef4444',
                  boxShadow: status.online ? '0 0 12px #22c55e' : '0 0 12px #ef4444',
                  animation: 'pulse 2s infinite'
                }} title={status.online ? 'Conectado' : 'Desconectado'} />
              </div>
              <div style={{ marginTop: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                Status: <span style={{ color: status.online ? '#22c55e' : '#ef4444', fontWeight: '600' }}>{status.online ? 'CONECTADO' : 'OFFLINE'}</span>
              </div>
            </div>

            {/* Card Última Atividade */}
            <div className="kpi-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Última Atividade</p>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
                {status.lastPulse ? new Date(status.lastPulse).toLocaleTimeString('pt-BR') : '--:--'}
              </h3>
              <p style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {status.lastPulse ? new Date(status.lastPulse).toLocaleDateString('pt-BR') : 'Sem registros recentes'}
              </p>
            </div>

            {/* Card Total Mensagens */}
            <div className="kpi-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Total de Mensagens</p>
              <h3 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)' }}>{status.totalLogs}</h3>
              <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Logs auditados</p>
            </div>
          </div>
        </section>

        {whatsappConfig && (
          <section className="content-section" style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
              URL do webhook (Chipmassa / Telein)
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '720px' }}>
              {whatsappConfig.hint} O número em <strong>Telefone remetente</strong> deve coincidir com o <strong>telefone informado no cadastro da conta</strong> (criação de conta).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Com ?token= (recomendado)</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <code style={{ fontSize: '12px', padding: '8px 10px', background: 'var(--bg-secondary, rgba(0,0,0,.06))', borderRadius: '6px', wordBreak: 'break-all', flex: '1', minWidth: '200px' }}>
                    {whatsappConfig.webhookUrlQuery}
                  </code>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => copyText('query', whatsappConfig.webhookUrlQuery)}>
                    Copiar
                  </button>
                </div>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Token no path (alternativa)</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <code style={{ fontSize: '12px', padding: '8px 10px', background: 'var(--bg-secondary, rgba(0,0,0,.06))', borderRadius: '6px', wordBreak: 'break-all', flex: '1', minWidth: '200px' }}>
                    {whatsappConfig.webhookUrlPath}
                  </code>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => copyText('path', whatsappConfig.webhookUrlPath)}>
                    Copiar
                  </button>
                </div>
              </div>
            </div>
            {copyFeedback && (
              <p style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '10px' }}>Copiado ({copyFeedback}).</p>
            )}
          </section>
        )}

        <section className="content-section" style={{ gridColumn: '1 / -1' }}>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</div>}
          
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <p>Carregando registros...</p>
            ) : logs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma mensagem processada ainda.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Data</th>
                    <th>Telefone Remetente</th>
                    <th style={{ minWidth: '200px' }}>Mensagem Dita</th>
                    <th>Status</th>
                    <th>Motivo/Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {new Date(log.data_hora).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ fontWeight: '600' }}>{log.telefone_remetente}</td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.mensagem_recebida}>
                        {log.mensagem_recebida || '(vazio)'}
                      </td>
                      <td>
                        {getStatusBadge(log.status)}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '250px' }}>
                        {log.detalhe_erro || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="content-section" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' }}>
            Controle de usuários
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Telefones da conta (cadastro inicial) usados pelo bot para vincular mensagens.
          </p>
          {loadingUsuarios ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando usuários...</p>
          ) : usuarios.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum usuário encontrado.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Telefone (WhatsApp)</th>
                    <th style={{ width: '120px' }}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: '600' }}>{row.email}</td>
                      <td>{row.telefone || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{row.id}</td>
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
