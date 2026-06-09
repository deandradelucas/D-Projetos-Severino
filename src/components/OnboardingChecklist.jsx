import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import '../styles/legacy/OnboardingChecklist.css'

const DISMISS_KEY = 'severino_onboarding_dismissed'

/**
 * Checklist de ativação (primeiros passos) no topo do Dashboard.
 * Aparece só pra quem ainda não ativou; some quando completa ou é dispensado.
 *
 * @param {() => void} onRegistrarGasto  abre o modal de Nova Transação
 * @param {number} refreshSignal         muda para forçar recarregar (ex.: após salvar)
 */
export default function OnboardingChecklist({ onRegistrarGasto, refreshSignal = 0 }) {
  const [status, setStatus] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/onboarding'), { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        if (!cancel) setStatus(data)
      } catch {
        /* silencioso */
      } finally {
        if (!cancel) setLoaded(true)
      }
    }
    void load()
    return () => { cancel = true }
  }, [refreshSignal])

  if (!loaded || dismissed || !status || status.completo) return null

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  const pct = Math.round((status.feitos / status.total) * 100)

  return (
    <section className="onboarding" aria-label="Primeiros passos">
      <div className="onboarding__head">
        <div className="onboarding__head-text">
          <h2 className="onboarding__title">Vamos começar 🚀</h2>
          <p className="onboarding__sub">{status.feitos} de {status.total} — leva menos de 2 minutos</p>
        </div>
        <button type="button" className="onboarding__dismiss" onClick={handleDismiss} aria-label="Dispensar">Dispensar</button>
      </div>

      <div className="onboarding__bar" aria-hidden><span className="onboarding__bar-fill" style={{ width: `${pct}%` }} /></div>

      <ul className="onboarding__steps">
        {status.steps.map((s) => (
          <li key={s.key} className={`onboarding__step${s.done ? ' onboarding__step--done' : ''}`}>
            <span className="onboarding__check" aria-hidden>
              {s.done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : null}
            </span>
            <span className="onboarding__step-label">{s.label}</span>
            {!s.done && s.cta === 'nova-transacao' && (
              <button type="button" className="onboarding__step-cta" onClick={onRegistrarGasto}>Lançar</button>
            )}
            {!s.done && s.cta && s.cta.startsWith('/') && (
              <Link to={s.cta} className="onboarding__step-cta">Abrir</Link>
            )}
          </li>
        ))}
      </ul>

      <p className="onboarding__tip">💬 Dica: você pode lançar gastos só mandando uma mensagem no WhatsApp — é o jeito mais rápido.</p>
    </section>
  )
}
