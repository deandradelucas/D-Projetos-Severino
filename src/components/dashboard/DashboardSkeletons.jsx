import React from 'react'

export function SkeletonKpi() {
  return (
    <div className="ref-kpi-card ref-kpi-card--skeleton" aria-hidden>
      <div className="skeleton skeleton-pulse ref-kpi-skel-icon" />
      <div className="ref-kpi-skel-body">
        <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--label" />
        <span className="skeleton skeleton-pulse ref-kpi-skel-line ref-kpi-skel-line--value" />
      </div>
    </div>
  )
}

export function SkeletonTxRow() {
  return (
    <div className="ref-tx-row ref-tx-row--skeleton" aria-hidden>
      <div className="ref-tx-icon-cell">
        <span className="skeleton skeleton-pulse ref-tx-skel-icon" />
      </div>
      <div className="ref-tx-meta-cell">
        <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--meta" />
      </div>
      <div className="ref-tx-cat-cell">
        <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--cat" />
      </div>
      <div className="ref-tx-sub-cell">
        <span className="skeleton skeleton-pulse ref-tx-skel-line ref-tx-skel-line--sub" />
      </div>
      <div className="ref-tx-rec-cell ref-tx-rec-cell--skeleton" aria-hidden />
      <div className="ref-tx-val-cell">
        <span className="skeleton skeleton-pulse ref-tx-skel-pill" />
      </div>
    </div>
  )
}
