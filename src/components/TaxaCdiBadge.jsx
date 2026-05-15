import React, { useEffect, useState } from 'react'
import { fetchTaxaCdiDeduplicated, formatCdiPercentPtBr } from '../lib/taxaCdiClient'

/**
 * @param {{ variant?: 'sidebar' | 'hero' }} props
 */
export default function TaxaCdiBadge({ variant = 'hero' }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [valorFmt, setValorFmt] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchTaxaCdiDeduplicated()
      .then((data) => {
        if (cancelled) return
        setErr('')
        setValorFmt(formatCdiPercentPtBr(data.valor_aa))
      })
      .catch((e) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : 'Indisponível')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const baseClass =
    variant === 'sidebar' ? 'taxa-cdi-badge taxa-cdi-badge--sidebar' : 'taxa-cdi-badge taxa-cdi-badge--hero'

  if (variant === 'sidebar') {
    return (
      <span className={baseClass} role="status" aria-live="polite" aria-busy={loading}>
        <span className="taxa-cdi-badge__k">Taxa CDI</span>
        {loading ? (
          <span className="taxa-cdi-badge__v taxa-cdi-badge__v--muted">…</span>
        ) : err ? (
          <span className="taxa-cdi-badge__v taxa-cdi-badge__v--warn" title={err}>
            —
          </span>
        ) : (
          <span className="taxa-cdi-badge__v">{valorFmt}</span>
        )}
      </span>
    )
  }

  return (
    <div className={baseClass} role="region" aria-label="Taxa CDI atualizada pelo BCB" aria-busy={loading}>
      <span className="taxa-cdi-badge__k">Taxa CDI</span>
      {loading ? (
        <span className="taxa-cdi-badge__pill taxa-cdi-badge__pill--muted">A carregar…</span>
      ) : err ? (
        <span className="taxa-cdi-badge__pill taxa-cdi-badge__pill--warn" title={err}>
          Indisponível
        </span>
      ) : (
        <span className="taxa-cdi-badge__pill">{valorFmt}</span>
      )}
    </div>
  )
}
