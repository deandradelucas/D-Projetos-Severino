import React from 'react'
import { paymentStatusLabel } from '../../lib/usersAdmin'

const base = {
  padding: '4px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  display: 'inline-block',
  whiteSpace: 'nowrap',
}

/**
 * @param {{ paymentStatus?: string|null, isOverdue?: boolean, className?: string }} props
 */
export default function UserAdminStatusBadge({ paymentStatus, isOverdue, className = '' }) {
  const label = paymentStatusLabel(paymentStatus)
  const k = String(paymentStatus || '').toLowerCase()
  let style = { ...base, backgroundColor: 'rgba(148,163,184,0.2)', color: '#64748b' }
  if (k === 'pago' || k === 'isento') {
    style = { ...base, backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' }
  } else if (k === 'trial_ativo') {
    style = { ...base, backgroundColor: 'rgba(99,102,241,0.18)', color: '#4f46e5' }
  } else if (k === 'inadimplente' || isOverdue) {
    style = { ...base, backgroundColor: 'rgba(239,68,68,0.14)', color: '#b91c1c' }
  } else if (k === 'sem_trial') {
    style = { ...base, backgroundColor: 'rgba(234,179,8,0.18)', color: '#a16207' }
  }

  return (
    <span className={`user-admin-fin-badge${className ? ` ${className}` : ''}`} style={style}>
      {label}
    </span>
  )
}
