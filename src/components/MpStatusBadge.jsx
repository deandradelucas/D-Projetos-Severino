/**
 * Badge de status Mercado Pago: aprovado (verde), pendente (laranja).
 */
export default function MpStatusBadge({ status, label }) {
  const base = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block',
  }
  const show = label !== undefined ? label : status || '—'
  if (status === undefined || status === null || String(status).trim() === '') {
    return <span style={{ ...base, backgroundColor: 'rgba(100, 100, 100, 0.1)', color: '#666' }}>{show}</span>
  }

  const s = String(status).toLowerCase()

  if (s === 'approved' || s === 'authorized') {
    return (
      <span style={{ ...base, backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a' }}>{show}</span>
    )
  }
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') {
    return (
      <span style={{ ...base, backgroundColor: 'rgba(249, 115, 22, 0.14)', color: '#ea580c' }}>{show}</span>
    )
  }
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(s)) {
    return (
      <span style={{ ...base, backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>{show}</span>
    )
  }
  return <span style={{ ...base, backgroundColor: 'rgba(100, 100, 100, 0.1)', color: '#666' }}>{show}</span>
}
