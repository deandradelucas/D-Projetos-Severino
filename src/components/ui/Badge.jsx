
const VARIANTS = {
  // Semânticas financeiras
  positive: {
    background: 'var(--success-muted)',
    color: 'var(--success-text)',
  },
  negative: {
    background: 'var(--error-muted)',
    color: 'var(--error-text)',
  },
  pending: {
    background: 'var(--warning-muted)',
    color: 'var(--warning-text)',
  },
  info: {
    background: 'var(--info-muted)',
    color: 'var(--info-text)',
  },
  scheduled: {
    background: 'var(--accent-muted)',
    color: 'var(--accent)',
  },
  neutral: {
    background: 'rgba(148, 163, 184, 0.12)',
    color: 'var(--text-muted)',
  },
  // Genéricas
  default: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
  },
  accent: {
    background: 'var(--accent-muted)',
    color: 'var(--accent)',
  },
}

const SIZES = {
  sm: { padding: '2px 6px', fontSize: '11px', borderRadius: '5px', gap: '3px' },
  md: { padding: '3px 8px', fontSize: '12px', borderRadius: '6px', gap: '4px' },
  lg: { padding: '4px 10px', fontSize: '13px', borderRadius: '7px', gap: '5px' },
}

export default function Badge({
  variant = 'default',
  size = 'md',
  icon = null,
  children,
  className = '',
  style = {},
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.default
  const s = SIZES[size] ?? SIZES.md

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    ...v,
    ...s,
    ...style,
  }

  return (
    <span
      className={`hz-badge hz-badge--${variant}${className ? ` ${className}` : ''}`}
      style={base}
      {...props}
    >
      {icon ? <span style={{ display: 'flex', alignItems: 'center', width: s.fontSize, height: s.fontSize }}>{icon}</span> : null}
      {children}
    </span>
  )
}

// Mapa de status de pagamento → variant do Badge
const STATUS_MAP = {
  approved: 'positive',
  authorized: 'positive',
  accredited: 'positive',
  received: 'positive',
  confirmed: 'positive',
  pending: 'pending',
  in_process: 'pending',
  in_mediation: 'pending',
  awaiting_risk_analysis: 'pending',
  overdue: 'pending',
  refunded: 'neutral',
  charged_back: 'neutral',
  cancelled: 'negative',
  rejected: 'negative',
  scheduled: 'scheduled',
}

export function PaymentBadge({ status, label, size = 'md', className = '', ...props }) {
  const variant = status ? (STATUS_MAP[String(status).toLowerCase()] ?? 'neutral') : 'neutral'
  const show = label !== undefined ? label : status || '—'
  return (
    <Badge variant={variant} size={size} className={className} {...props}>
      {show}
    </Badge>
  )
}
