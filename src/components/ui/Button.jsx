import React, { forwardRef } from 'react'

const VARIANTS = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-foreground)',
    border: 'none',
    '--btn-hover-bg': 'var(--accent-hover)',
    '--btn-hover-shadow': 'var(--shadow-accent)',
  },
  secondary: {
    background: 'var(--bg-card-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    '--btn-hover-bg': 'var(--bg-card-elevated)',
    '--btn-hover-border': 'var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    '--btn-hover-bg': 'var(--bg-card)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
    '--btn-hover-bg': 'var(--accent-muted)',
  },
  danger: {
    background: 'var(--error-muted)',
    color: 'var(--error-text)',
    border: '1px solid rgba(var(--error), 0.3)',
    '--btn-hover-bg': 'var(--error)',
    '--btn-hover-color': '#ffffff',
  },
  'ghost-danger': {
    background: 'transparent',
    color: 'var(--error-text)',
    border: 'none',
    '--btn-hover-bg': 'var(--error-muted)',
  },
}

const SIZES = {
  sm: { height: '32px', padding: '0 12px', fontSize: 'var(--font-size-sm)', borderRadius: 'var(--radius-md)' },
  md: { height: '40px', padding: '0 16px', fontSize: 'var(--font-size-base)', borderRadius: 'var(--radius-md)' },
  lg: { height: '48px', padding: '0 20px', fontSize: 'var(--font-size-lg)', borderRadius: 'var(--radius-lg)' },
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    children,
    className = '',
    style = {},
    ...props
  },
  ref,
) {
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const s = SIZES[size] ?? SIZES.md

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, opacity 0.15s ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    ...v,
    ...s,
    ...style,
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`hz-btn hz-btn--${variant} hz-btn--${size}${className ? ` ${className}` : ''}`}
      style={base}
      {...props}
    >
      {loading ? <Spinner size={size} /> : null}
      {children}
    </button>
  )
})

function Spinner({ size }) {
  const dim = size === 'sm' ? 12 : size === 'lg' ? 18 : 15
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'hz-btn-spin 0.7s linear infinite', flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="10" />
      <style>{`@keyframes hz-btn-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

export default Button
