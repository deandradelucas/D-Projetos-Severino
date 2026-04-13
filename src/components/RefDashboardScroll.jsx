/**
 * Coluna rolável do shell (`.ref-dashboard-scroll`).
 *
 * LOCK — ver AGENTS.md «Shell hub»: o 1.º filho deve ser sempre `.dashboard-hub__hero`;
 * não colocar o hero fora deste wrapper nas páginas hub.
 */
export default function RefDashboardScroll({ children }) {
  return <div className="ref-dashboard-scroll">{children}</div>
}
