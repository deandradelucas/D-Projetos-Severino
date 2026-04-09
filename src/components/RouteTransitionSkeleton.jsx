import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '../pages/dashboard.css'

const SHELL_PATH = /^\/(dashboard|transacoes|relatorios|configuracoes|pagamento|admin)/

/** Evita flash de skeleton no 1º paint e com React Strict Mode (remount). */
let routeTransitionBootstrapped = false

export default function RouteTransitionSkeleton() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (!routeTransitionBootstrapped) {
      routeTransitionBootstrapped = true
      prevPath.current = location.pathname
      return
    }
    if (prevPath.current === location.pathname) return

    prevPath.current = location.pathname

    const timeouts = []
    const defer = (fn) => {
      timeouts.push(window.setTimeout(fn, 0))
    }

    if (!SHELL_PATH.test(location.pathname)) {
      defer(() => setVisible(false))
      return () => timeouts.forEach((id) => window.clearTimeout(id))
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      return
    }

    defer(() => setVisible(true))
    timeouts.push(window.setTimeout(() => setVisible(false), 380))
    return () => timeouts.forEach((id) => window.clearTimeout(id))
  }, [location.pathname])

  if (!visible) return null

  return (
    <div className="route-transition-skeleton" aria-hidden role="presentation">
      <div className="route-transition-skeleton__panel">
        <div className="route-transition-skeleton__shine" />
        <div className="route-transition-skeleton__inner skeleton-stagger">
          <div className="route-transition-skeleton__header">
            <div className="skeleton skeleton-pulse route-transition-skeleton__title" />
            <div className="skeleton skeleton-pulse route-transition-skeleton__subtitle" />
          </div>
          <div className="route-transition-skeleton__kpis">
            <div className="skeleton skeleton-card route-transition-skeleton__kpi">
              <div className="skeleton-card-header">
                <div className="skeleton skeleton-text skeleton-pulse" />
                <div className="skeleton skeleton-icon skeleton-pulse" />
              </div>
              <div className="skeleton skeleton-value skeleton-pulse" />
              <div className="skeleton skeleton-badge skeleton-pulse" />
            </div>
            <div className="skeleton skeleton-card route-transition-skeleton__kpi">
              <div className="skeleton-card-header">
                <div className="skeleton skeleton-text skeleton-pulse" />
                <div className="skeleton skeleton-icon skeleton-pulse" />
              </div>
              <div className="skeleton skeleton-value skeleton-pulse" />
              <div className="skeleton skeleton-badge skeleton-pulse" />
            </div>
            <div className="skeleton skeleton-card route-transition-skeleton__kpi">
              <div className="skeleton-card-header">
                <div className="skeleton skeleton-text skeleton-pulse" />
                <div className="skeleton skeleton-icon skeleton-pulse" />
              </div>
              <div className="skeleton skeleton-value skeleton-pulse" />
              <div className="skeleton skeleton-badge skeleton-pulse" />
            </div>
          </div>
          <div className="skeleton skeleton-chart route-transition-skeleton__block">
            <div className="skeleton-chart-header">
              <div className="skeleton skeleton-chart-title skeleton-pulse" />
              <div className="skeleton-chart-legend">
                <span className="skeleton skeleton-pulse" />
                <span className="skeleton skeleton-pulse" />
              </div>
            </div>
            <div className="skeleton skeleton-chart-area skeleton-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
