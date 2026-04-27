/**
 * Fallback leve enquanto o chunk da rota carrega (lazy + Suspense).
 */
export default function RoutePageFallback() {
  return (
    <div className="route-page-fallback" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">A carregar página…</span>
      <div className="route-page-fallback__bar" aria-hidden />
    </div>
  )
}
