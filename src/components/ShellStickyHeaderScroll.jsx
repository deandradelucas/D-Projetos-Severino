import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const MAIN_SELECTOR = '.dashboard-container.app-horizon-shell > .app-horizon-inner > main.main-content'
const SCROLLED_CLASS = 'ref-dashboard-main--scrolled'
const SCROLL_THRESHOLD_PX = 8

/**
 * Mobile shell: ao rolar o <main>, marca o main com classe para vitrificar o cabeçalho (CSS em dashboard.css).
 */
export default function ShellStickyHeaderScroll() {
  const location = useLocation()

  useEffect(() => {
    let detach = () => {}
    const tid = window.setTimeout(() => {
      const main = document.querySelector(MAIN_SELECTOR)
      if (!main) return

      const onScroll = () => {
        main.classList.toggle(SCROLLED_CLASS, main.scrollTop > SCROLL_THRESHOLD_PX)
      }

      onScroll()
      main.addEventListener('scroll', onScroll, { passive: true })

      detach = () => {
        main.removeEventListener('scroll', onScroll)
        main.classList.remove(SCROLLED_CLASS)
      }
    }, 0)

    return () => {
      window.clearTimeout(tid)
      detach()
    }
  }, [location.pathname, location.search, location.key])

  return null
}
