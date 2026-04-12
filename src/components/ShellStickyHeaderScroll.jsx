import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const MAIN_SELECTOR = '.dashboard-container.app-horizon-shell > .app-horizon-inner > main.main-content'
const SCROLLED_CLASS = 'ref-dashboard-main--scrolled'
const SCROLL_THRESHOLD_PX = 8

function isVerticalScrollPort(el) {
  if (!el || el.nodeType !== 1) return false
  const cs = window.getComputedStyle(el)
  const oy = cs.overflowY
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false
  /* Shell desktop: overflow-y auto no container antes do conteúdo medir altura — precisa do listener desde cedo */
  if (el.classList.contains('dashboard-container') && el.classList.contains('app-horizon-shell')) {
    return true
  }
  return el.scrollHeight > el.clientHeight + 1
}

/** Todos os ancestrais do <main> que rolam na vertical + o scrollingElement da página (viewport). */
function collectVerticalScrollPorts(main) {
  const out = []
  const seen = new Set()
  const push = (el) => {
    if (!el || seen.has(el)) return
    seen.add(el)
    out.push(el)
  }

  let node = main
  while (node) {
    if (isVerticalScrollPort(node)) push(node)
    node = node.parentElement
  }

  const se = document.scrollingElement || document.documentElement
  if (se && isVerticalScrollPort(se)) push(se)

  return out
}

function maxScrollTop(els) {
  let m = 0
  for (const el of els) {
    m = Math.max(m, el.scrollTop)
  }
  return m
}

/**
 * Shell autenticado: marca o <main> com classe para o CSS do cabeçalho (fundo transparente só com rolagem).
 * O scroll pode estar no <main> (mobile), no .dashboard-container (desktop) ou na viewport — o evento scroll não borbulha.
 */
export default function ShellStickyHeaderScroll() {
  const location = useLocation()

  useEffect(() => {
    let detach = () => {}
    const tid = window.setTimeout(() => {
      const main = document.querySelector(MAIN_SELECTOR)
      if (!main) return

      let ports = []

      const onScroll = () => {
        main.classList.toggle(SCROLLED_CLASS, maxScrollTop(ports) > SCROLL_THRESHOLD_PX)
      }

      const bind = () => {
        for (const el of ports) {
          el.removeEventListener('scroll', onScroll)
        }
        ports = collectVerticalScrollPorts(main)
        for (const el of ports) {
          el.addEventListener('scroll', onScroll, { passive: true })
        }
        onScroll()
      }

      bind()
      const onResize = () => bind()
      window.addEventListener('resize', onResize, { passive: true })

      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => bind()) : null
      if (ro) ro.observe(main)

      detach = () => {
        window.removeEventListener('resize', onResize)
        if (ro) ro.disconnect()
        for (const el of ports) {
          el.removeEventListener('scroll', onScroll)
        }
        ports = []
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
