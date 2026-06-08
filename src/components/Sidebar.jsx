import { Fragment, useCallback, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useMatch, useResolvedPath } from 'react-router-dom'
import { navPrefetchHandlers, prefetchAppNavChunksNow } from '../lazyRoutes'
import SeverinoMark from './SeverinoMark'
import { logoutHorizonte } from '../lib/logout'
import { MAIN_NAV_ITEMS } from '../lib/navItems'
import { version } from '../../package.json'

const SIDEBAR_ICON_PROPS = { strokeWidth: '1.5', width: '22', height: '22' }

/* Seções da sidebar (na ordem de exibição). 'principal' (Dashboard) renderiza
   sem label, acima das demais. */
const SIDEBAR_SECTIONS = [
  { key: 'financas', label: 'Finanças' },
  { key: 'organizacao', label: 'Organização' },
  { key: 'conta', label: 'Conta' },
]

function mergeNavItemClass(isActive, href, pathname, extraClass = '') {
  const on = Boolean(isActive) || pathname === href
  const base = extraClass ? `nav-item ${extraClass}` : 'nav-item'
  return on ? `${base} active` : base
}

function SidebarNavItem({ item, pathname, closeMenu }) {
  const resolved = useResolvedPath(item.to)
  const match = useMatch({ path: resolved.pathname, end: item.end ?? false })
  const isActive = Boolean(match)
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        {...navPrefetchHandlers(item.to)}
        title={item.title || item.label}
        aria-current={isActive ? 'page' : undefined}
        className={mergeNavItemClass(isActive, item.to, pathname, item.sidebarClassName)}
        onClick={closeMenu}
      >
        <span className="icon-wrap">{item.icon(SIDEBAR_ICON_PROPS)}</span>
        <span className="nav-item__label">{item.label}</span>
      </NavLink>
    </li>
  )
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false
    return el.offsetParent !== null || el === document.activeElement
  })
}

export default function Sidebar({ menuAberto, setMenuAberto }) {
  const { pathname } = useLocation()
  const sidebarRef = useRef(null)
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)
  const closeMenu = useCallback(() => setMenuAberto(false), [setMenuAberto])

  /* Mobile: espera a animação do drawer terminar antes de aquecer chunks. */
  useEffect(() => {
    if (!menuAberto) return undefined

    let idleId = null
    const timeoutId = window.setTimeout(() => {
      const run = () => prefetchAppNavChunksNow()
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(run, { timeout: 1200 })
      } else {
        run()
      }
    }, 430)

    return () => {
      window.clearTimeout(timeoutId)
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [menuAberto])

  useEffect(() => {
    document.body.classList.toggle('horizon-sidebar-open', menuAberto)
    return () => {
      document.body.classList.remove('horizon-sidebar-open')
    }
  }, [menuAberto])

  useEffect(() => {
    if (!menuAberto) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        return
      }

      if (e.key !== 'Tab') return
      const focusable = getFocusableElements(sidebarRef.current)
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !sidebarRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
        return
      }

      if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeMenu, menuAberto])

  useEffect(() => {
    if (!menuAberto) return undefined

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raf = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(raf)
      const opener = openerRef.current
      openerRef.current = null
      if (opener && document.contains(opener)) {
        window.setTimeout(() => opener.focus({ preventScroll: true }), 0)
      }
    }
  }, [menuAberto])

  const renderNavItem = (item) => (
    <SidebarNavItem key={item.to} item={item} pathname={pathname} closeMenu={closeMenu} />
  )

  return (
    <>
      {/* Mobile Backdrop */}
      {menuAberto && (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Fechar menu"
          onClick={closeMenu}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`sidebar ${menuAberto ? 'open' : ''}`}
        role={menuAberto ? 'dialog' : undefined}
        aria-modal={menuAberto ? 'true' : undefined}
        aria-label="Menu principal"
      >
        <div className="brand-wrapper">
          <Link
            to="/dashboard"
            className="brand-stack"
            aria-label="Severino — ir para o Dashboard"
            onClick={closeMenu}
          >
            <SeverinoMark className="brand-mark" />
            <strong className="brand-wordmark">Severino</strong>
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            className="mobile-close-btn"
            aria-label="Fechar menu"
            onClick={closeMenu}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <ul className="nav-menu">
          {/* Principal (Dashboard) — sem label de seção */}
          {MAIN_NAV_ITEMS.filter((item) => item.section === 'principal').map(renderNavItem)}

          {/* Demais seções com label */}
          {SIDEBAR_SECTIONS.map((sec) => {
            const items = MAIN_NAV_ITEMS.filter((item) => item.section === sec.key)
            if (items.length === 0) return null
            return (
              <Fragment key={sec.key}>
                <li className="nav-section-label">
                  <span className="nav-section-label__text">{sec.label}</span>
                </li>
                {items.map(renderNavItem)}
              </Fragment>
            )
          })}
        </ul>

        <span className="sidebar-version">v{version}</span>

        <button
          type="button"
          className="logout-btn"
          aria-label="Sair da conta"
          onClick={logoutHorizonte}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          <span className="logout-btn__label">Sair</span>
        </button>
      </aside>
    </>
  )
}
