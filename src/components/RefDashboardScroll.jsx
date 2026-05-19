import React from 'react'

/**
 * Coluna rolável do shell (`.ref-dashboard-scroll`).
 *
 * LOCK — ver AGENTS.md «Shell hub»: o 1.º filho deve ser sempre `.dashboard-hub__hero`;
 * não colocar o hero fora deste wrapper nas páginas hub.
 */
const RefDashboardScroll = React.forwardRef(function RefDashboardScroll({ children }, ref) {
  return <div className="ref-dashboard-scroll" ref={ref}>{children}</div>
})
export default RefDashboardScroll
