import { useEffect, useState } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import './DashboardInsightsStrip.css'

/**
 * Faixa de insights proativos da "Severino IA" no topo do Dashboard.
 * Regras determinísticas no backend (sem custo de IA). Não renderiza nada se vazio.
 */
export default function DashboardInsightsStrip() {
  const [insights, setInsights] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/insights'), { cache: 'no-store' })
        const data = res.ok ? await res.json() : []
        if (!cancel) setInsights(Array.isArray(data) ? data : [])
      } catch {
        /* silencioso — feature não-crítica */
      } finally {
        if (!cancel) setLoaded(true)
      }
    }
    void load()
    return () => { cancel = true }
  }, [])

  if (!loaded || insights.length === 0) return null

  return (
    <section className="ai-insights" aria-label="Insights da Severino IA">
      <div className="ai-insights__head">
        <span className="ai-insights__spark" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 14.5 8.5 20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
          </svg>
        </span>
        <span className="ai-insights__title">Severino IA</span>
        <span className="ai-insights__sub">o que percebi nas suas finanças</span>
      </div>
      <div className="ai-insights__track">
        {insights.map((it) => (
          <article key={it.id} className={`ai-insight ai-insight--${it.tom || 'neutro'}`}>
            <span className="ai-insight__icon" aria-hidden>{it.icone || '✨'}</span>
            <div className="ai-insight__body">
              <h3 className="ai-insight__title">{it.titulo}</h3>
              <p className="ai-insight__text">{it.texto}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
