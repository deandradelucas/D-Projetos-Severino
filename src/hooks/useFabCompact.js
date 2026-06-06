import { useEffect, useState } from 'react'

/**
 * Encolhe o FAB padrão (`.dashboard-mobile-tx-fab`) ao rolar a tela no mobile —
 * o rótulo some e ele vira só o círculo «+» (estado `--compact`).
 *
 * REGRA DE PADRONIZAÇÃO (ver AGENTS.md «FAB padrão»): todo botão primário de
 * criar (Nova transação, Novo investimento, Nova agenda, Nova lista, Novo
 * cartão, Nova meta) usa o FAB `.dashboard-mobile-tx-fab` + este hook para ter
 * exatamente o mesmo layout e o mesmo efeito de minimizar ao rolar.
 *
 * @param {React.RefObject<HTMLElement>} scrollRef  ref do container rolável
 *        (normalmente o `<RefDashboardScroll ref={...}>` → `.ref-dashboard-scroll`).
 * @param {object} [opts]
 * @param {number} [opts.threshold=36]  scrollTop em px a partir do qual encolhe.
 * @returns {boolean} `true` quando o FAB deve estar compacto.
 */
export function useFabCompact(scrollRef, { threshold = 36 } = {}) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) return
    const root = scrollRef.current
    if (!root) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setCompact(root.scrollTop > threshold)
      })
    }

    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      root.removeEventListener('scroll', onScroll)
    }
  }, [scrollRef, threshold])

  return compact
}

export default useFabCompact
