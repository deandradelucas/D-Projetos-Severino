import React from 'react'
import { formatRelativeAgo } from '../../lib/adminUsuariosUtils.js'

export default function UltimoAcessoCell({ row, getUserConnectionBadge }) {
  if (!row.last_login_at) {
    return (
      <div className="page-admin-usuarios-acesso-stack">
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Nunca acessou</div>
        <div className="admin-subline">Nenhum login registrado no sistema</div>
      </div>
    )
  }

  const when = new Date(row.last_login_at)
  if (Number.isNaN(when.getTime())) {
    const badgeBad = getUserConnectionBadge(row)
    return (
      <div className="page-admin-usuarios-acesso-stack">
        <div style={{ fontWeight: 600, fontSize: '13px' }}>Data inválida</div>
        {badgeBad ? <div>{badgeBad}</div> : null}
      </div>
    )
  }

  const formatted = when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const rel = formatRelativeAgo(when)
  const badge = getUserConnectionBadge(row)

  return (
    <div className="page-admin-usuarios-acesso-stack">
      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{formatted}</div>
      <div className="admin-subline">{rel}</div>
      {badge ? <div className="page-admin-usuarios-acesso-badge">{badge}</div> : null}
    </div>
  )
}
