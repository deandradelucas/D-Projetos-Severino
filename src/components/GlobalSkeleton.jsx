export default function GlobalSkeleton({ variant = 'table', rows = 6 }) {
  if (variant === 'cards') {
    return (
      <div className="global-skeleton global-skeleton--cards skeleton-stagger" aria-hidden>
        <div className="skeleton skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton skeleton-text skeleton-pulse" />
            <div className="skeleton skeleton-icon skeleton-pulse" />
          </div>
          <div className="skeleton skeleton-value skeleton-pulse" />
          <div className="skeleton skeleton-badge skeleton-pulse" />
        </div>
        <div className="skeleton skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton skeleton-text skeleton-pulse" />
            <div className="skeleton skeleton-icon skeleton-pulse" />
          </div>
          <div className="skeleton skeleton-value skeleton-pulse" />
          <div className="skeleton skeleton-badge skeleton-pulse" />
        </div>
        <div className="skeleton skeleton-card">
          <div className="skeleton-card-header">
            <div className="skeleton skeleton-text skeleton-pulse" />
            <div className="skeleton skeleton-icon skeleton-pulse" />
          </div>
          <div className="skeleton skeleton-value skeleton-pulse" />
          <div className="skeleton skeleton-badge skeleton-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="global-skeleton global-skeleton--table skeleton-stagger" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row">
          <div className="skeleton-row-date">
            <span className="skeleton skeleton-pulse" />
            <span className="skeleton skeleton-pulse" style={{ width: '28px', height: '8px' }} />
          </div>
          <div className="skeleton-row-content">
            <span className="skeleton skeleton-pulse" />
            <span className="skeleton skeleton-pulse" style={{ width: '58%', height: '10px' }} />
          </div>
          <div className="skeleton skeleton-row-value" />
        </div>
      ))}
    </div>
  )
}
