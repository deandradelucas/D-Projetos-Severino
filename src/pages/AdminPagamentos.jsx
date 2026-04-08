import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import './dashboard.css'

function badgeStatus(status) {
  const s = String(status || 'pending').toLowerCase()
  const base = { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }
  if (s === 'approved' || s === 'authorized') {
    return <span style={{ ...base, backgroundColor: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>{status || '—'}</span>
  }
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') {
    return <span style={{ ...base, backgroundColor: 'rgba(234,179,8,0.12)', color: '#ca8a04' }}>{status || '—'}</span>
  }
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(s)) {
    return <span style={{ ...base, backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>{status || '—'}</span>
  }
  return <span style={{ ...base, backgroundColor: 'rgba(100,100,100,0.1)', color: '#666' }}>{status || '—'}</span>
}

export default function AdminPagamentos() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const userSaved = localStorage.getItem('horizonte_user')
        if (!userSaved) return
        const u = JSON.parse(userSaved)
        const res = await fetch('/api/admin/pagamentos', { headers: { 'x-user-id': u.id } })
        if (!res.ok) throw new Error('Falha ao carregar logs de pagamento.')
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const usuarioLabel = (row) => {
    const rel = row.usuarios
    if (rel && typeof rel === 'object' && !Array.isArray(rel)) {
      const em = rel.email || ''
      const nm = rel.nome || ''
      if (em && nm) return `${nm} (${em})`
      return em || nm || '—'
    }
    return row.usuario_id ? String(row.usuario_id).slice(0, 8) + '…' : '—'
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
                Logs de pagamentos
              </h1>
              <p className="responsive-p" style={{ color: 'var(--text-secondary)' }}>
                Mercado Pago — preferências e status dos pagamentos
              </p>
            </div>
          </div>
        </header>

        <section className="content-section" style={{ gridColumn: '1 / -1' }}>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '12px' }}>{error}</div>}
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum pagamento registrado ainda.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Usuário</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                    <th>ID pagamento</th>
                    <th>Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '200px' }} title={row.usuario_id || ''}>
                        {usuarioLabel(row)}
                      </td>
                      <td>{row.amount != null ? `R$ ${Number(row.amount).toFixed(2)}` : '—'}</td>
                      <td>{badgeStatus(row.status)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '160px' }}>
                        {row.status_detail || row.description || '—'}
                      </td>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '120px' }}>
                        {row.payment_id || '—'}
                      </td>
                      <td style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '140px' }}>
                        {row.external_reference || '—'}
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
