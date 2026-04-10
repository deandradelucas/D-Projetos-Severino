import { useState, useEffect } from 'react'

/**
 * Corresponde a `window.innerWidth < breakpoint` (ex.: 768 = layout “mobile” dos gráficos).
 * Usa matchMedia para alinhar a media query ao CSS e reduzir trabalho no resize.
 */
export function useMatchMaxWidth(breakpointPx = 768) {
  const maxW = Math.max(320, breakpointPx - 1)
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${maxW}px)`).matches : false
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxW}px)`)
    const apply = () => setMatches(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [maxW])

  return matches
}
