import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
import './dashboard.css'

function formatAuditWhen(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Quem é o “alvo” do evento na lista (ex.: e-mail do usuário que fez login). */
function auditEventSubject(row) {
  const te = row?.target_email != null ? String(row.target_email).trim() : ''
  if (te) return te
  const d = row?.detail
  if (d && typeof d === 'object' && typeof d.email === 'string') {
    const e = d.email.trim()
    if (e) return e
  }
  return '—'
}

export default function AdminAuditoria() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) {
        setError('Faça login para ver a auditoria.')
        setRows([])
        return
      }
      JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/audit-log?limit=80'), { headers: horizonteApiAuthHeaders() })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data && typeof data.message === 'string' ? data.message : 'Não foi possível carregar a auditoria.'
        setError(msg)
        setRows([])
        return
      }
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setError('Falha de rede ao carregar a auditoria.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="dashboard-container dashboard-page page-admin page-admin-auditoria ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <section className="dashboard-hub__hero" aria-label="Auditoria recente">
                <div className="dashboard-hub__hero-row">
                  <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                  <div className="dashboard-hub__hero-text">
                    <h1 className="dashboard-hub__title">Auditoria recente</h1>
                    <div className="dashboard-hub__balance-line" aria-live="polite">
                      <span>Registros exibidos:</span>
                      <strong>{loading ? '…' : rows.length}</strong>
                    </div>
                  </div>
                  <div className="dashboard-hub__hero-actions page-admin-hero-actions" role="toolbar" aria-label="Atalhos da administração">
                    <Link to="/admin/usuarios" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                      Logs de usuários
                    </Link>
                    <Link to="/admin/pagamentos" className="dashboard-hub__btn dashboard-hub__btn--secondary">
                      Logs de pagamentos
                    </Link>
                    <button type="button" className="dashboard-hub__btn dashboard-hub__btn--primary" disabled={loading} onClick={() => void load()}>
                      {loading ? 'Atualizando…' : 'Recarregar'}
                    </button>
                  </div>
                </div>
              </section>

              {error ? <div className="page-admin-alert">{error}</div> : null}

              <article className="ref-panel dashboard-hub__tx-panel page-admin-audit-card" aria-labelledby="admin-audit-heading">
                <div className="ref-panel__head page-admin-audit-card__head">
                  <div>
                    <h2 id="admin-audit-heading" className="ref-panel__title">
                      Eventos do sistema
                    </h2>
                    <p className="ref-panel__subtitle page-admin-audit-card__sub">
                      Até 80 entradas mais recentes da trilha de auditoria administrativa
                    </p>
                  </div>
                </div>
                <div className="page-admin-audit-card__body">
                  {loading ? (
                    <p className="page-admin-audit-empty" aria-busy="true">
                      Carregando…
                    </p>
                  ) : rows.length === 0 ? (
                    <p className="page-admin-audit-empty">Nenhum evento registrado ainda ou sem permissão para listar.</p>
                  ) : (
                    <ul className="page-admin-audit-mini-list page-admin-audit-mini-list--stack" role="list">
                      {rows.map((row) => {
                        const when = formatAuditWhen(row.created_at)
                        return (
                          <li key={row.id} className="audit-mini-item">
                            <span className="audit-mini-icon" aria-hidden>
                              ⚡
                            </span>
                            <span className="audit-mini-text">
                              <strong>{row.action}</strong>: {auditEventSubject(row)}
                              {when ? <span className="audit-mini-meta">{when}</span> : null}
                              {row.client_ip ? (
                                <span className="audit-mini-meta audit-mini-meta--ip">IP {row.client_ip}</span>
                              ) : null}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
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
