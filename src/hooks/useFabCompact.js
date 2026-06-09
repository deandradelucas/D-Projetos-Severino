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
    // No mobile o scroll é do DOCUMENTO (window); mantém o elemento como fallback
    // caso alguma página ainda use scroll interno no container.
    const root = scrollRef.current

    let raf = 0
    const read = () => {
      const winTop = window.scrollY || document.documentElement.scrollTop || 0
      const elTop = root ? root.scrollTop : 0
      setCompact(Math.max(winTop, elTop) > threshold)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        read()
      })
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    if (root) root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      if (root) root.removeEventListener('scroll', onScroll)
    }
  }, [scrollRef, threshold])

  return compact
}

export default useFabCompact
