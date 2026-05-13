import React from 'react'

const VARIANTS = {
  base: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--radius-lg)',
  },
  elevated: {
    background: 'var(--bg-card-elevated)',
    border: '1px solid var(--border-strong)',
    boxShadow: 'var(--shadow-lg)',
    borderRadius: 'var(--radius-lg)',
  },
  accent: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-accent)',
    boxShadow: 'var(--shadow-md), var(--shadow-accent)',
    borderRadius: 'var(--radius-xl)',
  },
  flat: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'none',
    borderRadius: 'var(--radius-lg)',
  },
  ghost: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    borderRadius: 'var(--radius-lg)',
  },
}

const ALERT_VARIANTS = {
  error:   'var(--error)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  info:    'var(--info)',
}

export default function Card({
  variant = 'base',
  alert = null,
  padding = '16px',
  hoverable = false,
  as: Tag = 'div',
  children,
  className = '',
  style = {},
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.base

  const base = {
    position: 'relative',
    overflow: 'hidden',
    transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    padding,
    ...v,
    ...(alert ? { borderLeft: `3px solid ${ALERT_VARIANTS[alert] ?? ALERT_VARIANTS.info}` } : {}),
    ...style,
  }

  const hoverHandlers = hoverable
    ? {
        onMouseEnter: (e) => {
          e.currentTarget.style.background = 'var(--bg-card-elevated)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = v.background
          e.currentTarget.style.borderColor = v.border?.replace('1px solid ', '') ?? ''
        },
      }
    : {}

  return (
    <Tag
      className={`hz-card hz-card--${variant}${alert ? ` hz-card--alert-${alert}` : ''}${hoverable ? ' hz-card--hoverable' : ''}${className ? ` ${className}` : ''}`}
      style={base}
      {...hoverHandlers}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ children, className = '', style = {} }) {
  return (
    <div
      className={`hz-card__header${className ? ` ${className}` : ''}`}
      style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', ...style }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', style = {} }) {
  return (
    <h3
      className={`hz-card__title${className ? ` ${className}` : ''}`}
      style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, ...style }}
    >
      {children}
    </h3>
  )
}

export function CardFooter({ children, className = '', style = {} }) {
  return (
    <div
      className={`hz-card__footer${className ? ` ${className}` : ''}`}
      style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px', ...style }}
    >
      {children}
    </div>
  )
}
