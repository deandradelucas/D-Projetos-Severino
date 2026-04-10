import React, { useEffect, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import MpStatusBadge from '../components/MpStatusBadge'
import AdminDataTableSkeleton from '../components/AdminDataTableSkeleton'
import { apiUrl } from '../lib/apiUrl'
import './dashboard.css'

const PAGAMENTOS_LOG_HEADERS = [
  'Data',
  'ID usuário',
  'Usuário',
  'Isenção',
  'Valor',
  'Status',
  'Detalhe',
  'ID pagamento',
  'Referência',
]

export default function AdminPagamentos() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [togglingUserId, setTogglingUserId] = useState(null)
  const [deletingPending, setDeletingPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) return
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/pagamentos'), { headers: { 'x-user-id': u.id } })
      if (!res.ok) throw new Error('Falha ao carregar logs de pagamento.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isentoDoUsuario = (row) => {
    const rel = row.usuarios
    if (rel && typeof rel === 'object' && !Array.isArray(rel)) {
      return rel.isento_pagamento === true
    }
    return false
  }

  const alternarIsencao = async (usuarioId, proximo) => {
    if (!usuarioId) return
    setActionMsg('')
    setTogglingUserId(usuarioId)
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl(`/api/admin/usuarios/${usuarioId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': u.id,
        },
        body: JSON.stringify({ isento_pagamento: proximo }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Não foi possível atualizar a isenção.')
      setRows((prev) =>
        prev.map((r) => {
          if (r.usuario_id !== usuarioId) return r
          const rel = r.usuarios
          if (rel && typeof rel === 'object' && !Array.isArray(rel)) {
            return { ...r, usuarios: { ...rel, isento_pagamento: proximo } }
          }
          return {
            ...r,
            usuarios: { email: '', nome: '', isento_pagamento: proximo },
          }
        })
      )
      setActionMsg(proximo ? 'Usuário marcado como isento de pagamento.' : 'Isenção removida.')
    } catch (e) {
      setActionMsg(e.message || 'Erro ao salvar.')
    } finally {
      setTogglingUserId(null)
    }
  }

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

  const handleExcluirLogsPendentes = async () => {
    if (
      !window.confirm(
        'Excluir todos os registros cujo status no Mercado Pago está pendente, em processamento ou em mediação? ' +
          'Aprovados, recusados e estornados não serão removidos. Esta ação não pode ser desfeita.'
      )
    ) {
      return
    }
    setDeletingPending(true)
    setActionMsg('')
    setError('')
    try {
      const userSaved = localStorage.getItem('horizonte_user')
      if (!userSaved) throw new Error('Sessão expirada.')
      const u = JSON.parse(userSaved)
      const res = await fetch(apiUrl('/api/admin/pagamentos/pendentes'), {
        method: 'DELETE',
        headers: { 'x-user-id': u.id },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Falha ao excluir logs pendentes.')
      setActionMsg(data.message || (data.deleted ? `${data.deleted} registro(s) excluído(s).` : 'Nenhum registro pendente.'))
      await load()
    } catch (e) {
      setError(e.message || 'Erro ao excluir.')
    } finally {
      setDeletingPending(false)
    }
  }

  return (
    <div className="dashboard-container page-admin app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner">
            <header className="ref-dashboard-header">
              <MobileMenuButton onClick={() => setMenuAberto(true)} />
              <div className="ref-dashboard-header__lead">
                <h1 className="ref-dashboard-greeting">
                  <span className="ref-dashboard-greeting__name">Logs de pagamentos</span>
                </h1>
                <p className="ref-panel__subtitle page-admin-header-sub">
                  Mercado Pago — preferências e status dos pagamentos
                </p>
              </div>
            </header>

            <article className="ref-panel page-admin-ref-panel page-admin-ref-panel--table" aria-labelledby="admin-pag-heading">
              <div className="ref-panel__head page-admin-pagamentos-panel-head">
                <div>
                  <h2 id="admin-pag-heading" className="ref-panel__title">
                    Registros
                  </h2>
                  <p className="ref-panel__subtitle">Histórico e isenções por usuário</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary page-admin-btn-danger-outline"
                  disabled={loading || deletingPending}
                  onClick={() => void handleExcluirLogsPendentes()}
                >
                  {deletingPending ? 'Excluindo…' : 'Excluir logs pendentes'}
                </button>
              </div>
              {error ? <div className="page-admin-error">{error}</div> : null}
              {actionMsg ? <div className="page-admin-action-msg">{actionMsg}</div> : null}
              <div className="page-admin-table-scroll">
                {loading ? (
                  <AdminDataTableSkeleton headers={PAGAMENTOS_LOG_HEADERS} rows={7} />
                ) : rows.length === 0 ? (
                  <p className="page-admin-empty">Nenhum pagamento registrado ainda.</p>
                ) : (
                  <table className="data-table page-admin-data-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>ID usuário</th>
                        <th>Usuário</th>
                        <th>Isenção</th>
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
                          <td
                            style={{ fontSize: '11px', fontFamily: 'monospace', maxWidth: '120px', wordBreak: 'break-all' }}
                            title={row.usuario_id || ''}
                          >
                            {row.usuario_id || '—'}
                          </td>
                          <td style={{ fontSize: '13px', maxWidth: '200px' }} title={row.usuario_id || ''}>
                            {usuarioLabel(row)}
                          </td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {row.usuario_id ? (
                              <>
                                <span
                                  style={{
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    marginRight: '8px',
                                    backgroundColor: isentoDoUsuario(row) ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.2)',
                                    color: isentoDoUsuario(row) ? '#16a34a' : '#64748b',
                                  }}
                                >
                                  {isentoDoUsuario(row) ? 'Isento' : 'Não isento'}
                                </span>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                  disabled={togglingUserId === row.usuario_id}
                                  onClick={() => alternarIsencao(row.usuario_id, !isentoDoUsuario(row))}
                                >
                                  {togglingUserId === row.usuario_id ? '…' : isentoDoUsuario(row) ? 'Remover' : 'Isentar'}
                                </button>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            )}
                          </td>
                          <td>{row.amount != null ? `R$ ${Number(row.amount).toFixed(2)}` : '—'}</td>
                          <td>
                            <MpStatusBadge status={row.status} />
                          </td>
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
                )}
              </div>
            </article>
          </div>
        </main>
      </div>
    </div>
  )
}
