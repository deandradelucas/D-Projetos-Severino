import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import './dashboard.css'

export default function AdminWhatsApp() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        if (!userSaved) return // No user
        const u = JSON.parse(userSaved)
        
        const res = await fetch('/api/admin/whatsapp-logs', {
          headers: { 'x-user-id': u.id }
        })
        if (!res.ok) throw new Error('Falha ao carregar logs')
        const data = await res.json()
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
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>Logs do WhatsApp</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Auditoria de mensagens recebidas pelo BOT</p>
            </div>
          </div>
        </header>

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

      </main>
    </div>
  )
}
