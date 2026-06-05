import { useCallback, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { canAccessAdminPanelSession } from '../lib/superAdmin'
import { navPrefetchHandlers, prefetchAppNavChunksNow } from '../lazyRoutes'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { useTheme } from '../context/ThemeContext'
import { logoutHorizonte } from '../lib/logout'
import { MAIN_NAV_ITEMS } from '../lib/navItems'
import { version } from '../../package.json'

const SIDEBAR_ICON_PROPS = { strokeWidth: '1.5', width: '22', height: '22' }

function mergeNavItemClass(isActive, href, pathname, extraClass = '') {
  const on = Boolean(isActive) || pathname === href
  const base = extraClass ? `nav-item ${extraClass}` : 'nav-item'
  return on ? `${base} active` : base
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
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const isLightTheme = theme !== 'dark'
  const sidebarMarkSrc = isLightTheme ? BRAND_ASSETS.sidebarMarkLight : BRAND_ASSETS.sidebarMarkDark
  const showAdminNav = canAccessAdminPanelSession()
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
          <span className="brand-stack" aria-label="Severino">
            <img
              src={sidebarMarkSrc}
              alt=""
              aria-hidden="true"
              className="brand-mark"
              decoding="sync"
            />
            <strong className="brand-wordmark">Severino</strong>
          </span>
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
          {MAIN_NAV_ITEMS.filter((item) => item.to !== '/configuracoes').map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                {...navPrefetchHandlers(item.to)}
                title={item.title || item.label}
                className={({ isActive }) => mergeNavItemClass(isActive, item.to, pathname)}
                onClick={closeMenu}
              >
                <span className="icon-wrap">{item.icon(SIDEBAR_ICON_PROPS)}</span>
                <span className="nav-item__label">{item.label}</span>
              </NavLink>
            </li>
          ))}

          <li>
            <NavLink
              to="/pagamento"
              end
              {...navPrefetchHandlers('/pagamento')}
              title="Pagamento — assinatura mensal (Asaas)"
              className={({ isActive }) => mergeNavItemClass(isActive, '/pagamento', pathname)}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </span>
              <span className="nav-item__label">Pagamento</span>
            </NavLink>
          </li>
          <li className="nav-section-label nav-section-label--account">
            <span className="nav-section-label__text">Conta</span>
          </li>
          {MAIN_NAV_ITEMS.filter((item) => item.to === '/configuracoes').map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                {...navPrefetchHandlers(item.to)}
                title={item.title || item.label}
                className={({ isActive }) => mergeNavItemClass(isActive, item.to, pathname, item.sidebarClassName)}
                onClick={closeMenu}
              >
                <span className="icon-wrap">{item.icon(SIDEBAR_ICON_PROPS)}</span>
                <span className="nav-item__label">{item.label}</span>
              </NavLink>
            </li>
          ))}

          {showAdminNav && (
            <>
              <li className="nav-section-label">
                <span className="nav-section-label__text">Administração</span>
              </li>
              <li>
                <NavLink
                  to="/admin/usuarios"
                  end
                  {...navPrefetchHandlers('/admin/usuarios')}
                  title="Logs Usuários"
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/usuarios', pathname)}
                  onClick={closeMenu}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <span className="nav-item__label">Logs Usuários</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/auditoria"
                  end
                  {...navPrefetchHandlers('/admin/auditoria')}
                  title="Auditoria"
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/auditoria', pathname)}
                  onClick={closeMenu}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </span>
                  <span className="nav-item__label">Auditoria</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/pagamentos"
                  end
                  {...navPrefetchHandlers('/admin/pagamentos')}
                  title="Logs de Pagamentos"
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/pagamentos', pathname)}
                  onClick={closeMenu}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                  </span>
                  <span className="nav-item__label">Logs de Pagamentos</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/marketing"
                  end
                  {...navPrefetchHandlers('/admin/marketing')}
                  title="Marketing"
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/marketing', pathname)}
                  onClick={closeMenu}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </span>
                  <span className="nav-item__label">Marketing</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>

        <span style={{ display: 'block', textAlign: 'center', fontSize: '0.65rem', opacity: 0.35, marginBottom: '6px', letterSpacing: '0.05em' }}>
          v{version}
        </span>

        <button
          className="logout-btn"
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
