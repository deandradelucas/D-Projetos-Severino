import React, { useEffect, useState } from 'react'
import { fetchTaxaSelicDeduplicated, formatSelicPercentPtBr } from '../lib/taxaSelicClient'

/**
 * @param {{ variant?: 'sidebar' | 'hero' }} props
 */
export default function TaxaSelicBadge({ variant = 'hero' }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [valorFmt, setValorFmt] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchTaxaSelicDeduplicated()
      .then((data) => {
        if (cancelled) return
        setErr('')
        setValorFmt(formatSelicPercentPtBr(data.valor_aa))
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
    variant === 'sidebar' ? 'taxa-selic-badge taxa-selic-badge--sidebar' : 'taxa-selic-badge taxa-selic-badge--hero'

  if (variant === 'sidebar') {
    return (
      <span className={baseClass} role="status" aria-live="polite" aria-busy={loading}>
        <span className="taxa-selic-badge__k">Taxa Selic</span>
        {loading ? (
          <span className="taxa-selic-badge__v taxa-selic-badge__v--muted">…</span>
        ) : err ? (
          <span className="taxa-selic-badge__v taxa-selic-badge__v--warn" title={err}>
            —
          </span>
        ) : (
          <span className="taxa-selic-badge__v">{valorFmt}</span>
        )}
      </span>
    )
  }

  return (
    <div className={baseClass} role="region" aria-label="Taxa Selic atualizada pelo BCB" aria-busy={loading}>
      <span className="taxa-selic-badge__k">Taxa Selic</span>
      {loading ? (
        <span className="taxa-selic-badge__pill taxa-selic-badge__pill--muted">A carregar…</span>
      ) : err ? (
        <span className="taxa-selic-badge__pill taxa-selic-badge__pill--warn" title={err}>
          Indisponível
        </span>
      ) : (
        <span className="taxa-selic-badge__pill">{valorFmt}</span>
      )}
    </div>
  )
}
