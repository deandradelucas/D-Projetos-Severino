/**
 * Fallback leve enquanto o chunk da rota carrega (lazy + Suspense).
 */
export default function RoutePageFallback() {
  return (
    <div className="route-page-fallback" role="status" aria-live="polite" aria-busy="true">
      <div className="route-page-fallback__bar" />
    </div>
  )
}
