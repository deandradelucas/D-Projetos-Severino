import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { canAccessAdminPanelSession } from '../lib/superAdmin'
import { navPrefetchHandlers, prefetchAppNavChunksNow } from '../lazyRoutes'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { useTheme } from '../context/ThemeContext'

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
  const showAdminNav = canAccessAdminPanelSession()
  const sidebarRef = useRef(null)
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)
  const closeMenu = useCallback(() => setMenuAberto(false), [setMenuAberto])

  /* Mobile: ao abrir o drawer, baixa chunks do menu em paralelo (clique na rota fica instantâneo). */
  useEffect(() => {
    if (menuAberto) prefetchAppNavChunksNow()
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

  const svgSrc = theme === 'light' ? BRAND_ASSETS.logoOnLight : BRAND_ASSETS.logoOnDark
  const pngSrc = theme === 'light' ? BRAND_ASSETS.logoOnLightPng : BRAND_ASSETS.logoOnDarkPng
  const [logoSrc, setLogoSrc] = useState(pngSrc)

  useEffect(() => {
    setLogoSrc(pngSrc)
  }, [pngSrc])

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
          <img
            key={logoSrc}
            src={logoSrc}
            alt="Horizonte Financeiro"
            className="brand-logo"
            width={1600}
            height={360}
            decoding="sync"
            onError={() => setLogoSrc(svgSrc)}
          />
          <span className="brand-wordmark" aria-hidden>
            HORIZONTE
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className="mobile-close-btn"
            aria-label="Fechar menu"
            onClick={closeMenu}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <ul className="nav-menu">
          <li>
            <NavLink
              to="/dashboard"
              end
              {...navPrefetchHandlers('/dashboard')}
              className={({ isActive }) => mergeNavItemClass(isActive, '/dashboard', pathname)}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="7" x="3" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="3" rx="1"/>
                  <rect width="7" height="7" x="14" y="14" rx="1"/>
                  <rect width="7" height="7" x="3" y="14" rx="1"/>
                </svg>
              </span>
              <span className="nav-item__label">Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/transacoes"
              end
              {...navPrefetchHandlers('/transacoes')}
              className={({ isActive }) => mergeNavItemClass(isActive, '/transacoes', pathname, 'nav-item--transactions')}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 7h10"/>
                  <path d="M7 12h10"/>
                  <path d="M7 17h6"/>
                </svg>
              </span>
              <span className="nav-item__label">Transações</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/relatorios"
              end
              {...navPrefetchHandlers('/relatorios')}
              title="Gráficos, resumo do período e exportação CSV ou PDF"
              className={({ isActive }) => mergeNavItemClass(isActive, '/relatorios', pathname)}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </span>
              <span className="nav-item__label">Relatórios</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/agenda"
              end
              {...navPrefetchHandlers('/agenda')}
              title="Compromissos, lembretes e interação via WhatsApp"
              className={({ isActive }) => mergeNavItemClass(isActive, '/agenda', pathname)}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M8 14h.01" />
                  <path d="M12 14h.01" />
                  <path d="M16 14h.01" />
                  <path d="M8 18h.01" />
                  <path d="M12 18h.01" />
                </svg>
              </span>
              <span className="nav-item__label">Agenda</span>
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/pagamento"
              end
              {...navPrefetchHandlers('/pagamento')}
              title="Assinatura mensal Mercado Pago"
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
          <li>
            <NavLink
              to="/configuracoes"
              end
              {...navPrefetchHandlers('/configuracoes')}
              title="Perfil, tema, biometria e dados"
              className={({ isActive }) => mergeNavItemClass(isActive, '/configuracoes', pathname, 'nav-item--settings')}
              onClick={closeMenu}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </span>
              <span className="nav-item__label">Ajustes</span>
            </NavLink>
          </li>

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
                  to="/admin/pagamentos"
                  end
                  {...navPrefetchHandlers('/admin/pagamentos')}
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
            </>
          )}
        </ul>

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('horizonte_user')
            window.location.href = '/'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Sair
        </button>
        <div style={{ marginTop: 'auto', padding: '10px 16px', fontSize: '10px', color: 'rgba(148, 163, 184, 0.4)', textAlign: 'center' }}>
          v3.0.2 - ADMIN UPDATE
        </div>
      </aside>
    </>
  )
}
