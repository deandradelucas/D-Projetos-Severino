/**
 * Badge de status Mercado Pago: aprovado (verde), pendente (laranja).
 * @param {{ status?: string|null, label?: string, className?: string }} props
 */
export default function MpStatusBadge({ status, label, className = '' }) {
  const base = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block',
  }
  const show = label !== undefined ? label : status || '—'
  const cn = className ? ` ${className}` : ''

  if (status === undefined || status === null || String(status).trim() === '') {
    return (
      <span className={`mp-status-badge mp-status-badge--empty${cn}`} style={{ ...base, backgroundColor: 'rgba(100, 100, 100, 0.1)', color: '#666' }}>
        {show}
      </span>
    )
  }

  const s = String(status).toLowerCase()

  if (s === 'approved' || s === 'authorized' || s === 'accredited') {
    return (
      <span className={`mp-status-badge mp-status-badge--ok${cn}`} style={{ ...base, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>
        {show}
      </span>
    )
  }
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') {
    return (
      <span className={`mp-status-badge mp-status-badge--pending${cn}`} style={{ ...base, backgroundColor: 'rgba(249, 115, 22, 0.14)', color: '#ea580c' }}>
        {show}
      </span>
    )
  }
  if (s === 'refunded' || s === 'charged_back') {
    return (
      <span className={`mp-status-badge mp-status-badge--refund${cn}`} style={{ ...base, backgroundColor: 'rgba(100, 116, 139, 0.18)', color: '#475569' }}>
        {show}
      </span>
    )
  }
  if (['rejected', 'cancelled'].includes(s)) {
    return (
      <span className={`mp-status-badge mp-status-badge--bad${cn}`} style={{ ...base, backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>
        {show}
      </span>
    )
  }
  return (
    <span className={`mp-status-badge mp-status-badge--muted${cn}`} style={{ ...base, backgroundColor: 'rgba(100, 100, 100, 0.1)', color: '#666' }}>
      {show}
    </span>
  )
}
