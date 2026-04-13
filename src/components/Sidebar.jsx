import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { canAccessAdminPanelSession } from '../lib/superAdmin'
import { navPrefetchHandlers, prefetchAppNavChunksNow } from '../lazyRoutes'
import { BRAND_ASSETS } from '../lib/brandAssets'
import { useTheme } from '../context/ThemeContext'

/** Ordem vertical no menu (índice sobe/desce a bolinha) */
const MENU_ORDER = [
  '/dashboard',
  '/transacoes',
  '/relatorios',
  '/pagamento',
  '/agenda',
  '/configuracoes',
  '/admin/whatsapp',
  '/admin/usuarios',
  '/admin/pagamentos',
]

function mergeNavItemClass(isActive, href, pathname, extraClass = '') {
  const on = Boolean(isActive) || pathname === href
  const base = extraClass ? `nav-item ${extraClass}` : 'nav-item'
  return on ? `${base} active` : base
}

export default function Sidebar({ menuAberto, setMenuAberto }) {
  const { theme } = useTheme()
  const location = useLocation()
  const { pathname } = location
  const prevMenuIdx = useRef(-1)
  const [dotMotion, setDotMotion] = useState(null)
  const navMenuRef = useRef(null)
  const [activeDotTop, setActiveDotTop] = useState(null)
  const [sessionBump, setSessionBump] = useState(0)
  const showAdminNav = canAccessAdminPanelSession()

  useEffect(() => {
    const bump = () => setSessionBump((n) => n + 1)
    window.addEventListener('horizonte-session-refresh', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('horizonte-session-refresh', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  /* Mobile: ao abrir o drawer, baixa chunks do menu em paralelo (clique na rota fica instantâneo). */
  useEffect(() => {
    if (menuAberto) prefetchAppNavChunksNow()
  }, [menuAberto])

  useEffect(() => {
    const idx = MENU_ORDER.indexOf(location.pathname)
    if (idx < 0) return

    if (prevMenuIdx.current >= 0 && prevMenuIdx.current !== idx) {
      const timeouts = []
      timeouts.push(
        window.setTimeout(() => setDotMotion(idx > prevMenuIdx.current ? 'down' : 'up'), 0)
      )
      timeouts.push(window.setTimeout(() => setDotMotion(null), 900))
      prevMenuIdx.current = idx
      return () => timeouts.forEach((id) => window.clearTimeout(id))
    }
    prevMenuIdx.current = idx
  }, [location.pathname])

  useLayoutEffect(() => {
    const ul = navMenuRef.current
    if (!ul) return

    const measure = () => {
      const active =
        ul.querySelector('a.nav-item.active') || ul.querySelector('a.nav-item[aria-current="page"]')
      if (!active) {
        setActiveDotTop(null)
        return
      }
      const ulRect = ul.getBoundingClientRect()
      const linkRect = active.getBoundingClientRect()
      const center = linkRect.top - ulRect.top + linkRect.height / 2
      setActiveDotTop(center)
    }

    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(ul)

    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [location.pathname, menuAberto, showAdminNav, sessionBump])

  const logoSrc = theme === 'light' ? BRAND_ASSETS.logoOnLight : BRAND_ASSETS.logoOnDark
  return (
    <>
      {/* Mobile Backdrop */}
      {menuAberto && (
        <div className="mobile-backdrop" onClick={() => setMenuAberto(false)} />
      )}

      <aside className={`sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="brand-wrapper">
          <img
            key={logoSrc}
            src={logoSrc}
            alt="Horizonte Financeiro"
            className="brand-logo"
            width={1600}
            height={360}
            decoding="sync"
          />
          <span className="brand-wordmark" aria-hidden>
            HORIZONTE
          </span>
          <button
            type="button"
            className="mobile-close-btn"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <ul
          ref={navMenuRef}
          className="nav-menu"
          data-dot-motion={dotMotion || undefined}
          style={
            activeDotTop == null
              ? undefined
              : { '--sidebar-nav-dot-y': `${activeDotTop}px`, '--sidebar-nav-dot-visible': '1' }
          }
        >
          <li>
            <NavLink
              to="/dashboard"
              end
              {...navPrefetchHandlers('/dashboard')}
              className={({ isActive }) => mergeNavItemClass(isActive, '/dashboard', pathname)}
              onClick={() => setMenuAberto(false)}
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
              className={({ isActive }) => mergeNavItemClass(isActive, '/transacoes', pathname)}
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                  <path d="M12 18V6"/>
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
              onClick={() => setMenuAberto(false)}
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
              to="/pagamento"
              end
              {...navPrefetchHandlers('/pagamento')}
              title="Assinatura mensal Mercado Pago"
              className={({ isActive }) => mergeNavItemClass(isActive, '/pagamento', pathname)}
              onClick={() => setMenuAberto(false)}
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
          <li>
            <NavLink
              to="/agenda"
              end
              {...navPrefetchHandlers('/agenda')}
              title="Compromissos, vencimentos e lembretes"
              className={({ isActive }) => mergeNavItemClass(isActive, '/agenda', pathname)}
              onClick={() => setMenuAberto(false)}
            >
              <span className="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
                </svg>
              </span>
              <span className="nav-item__label">Agenda</span>
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
              onClick={() => setMenuAberto(false)}
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
                  to="/admin/whatsapp"
                  end
                  {...navPrefetchHandlers('/admin/whatsapp')}
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/whatsapp', pathname)}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </span>
                  <span className="nav-item__label">Logs do WhatsApp</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/admin/usuarios"
                  end
                  {...navPrefetchHandlers('/admin/usuarios')}
                  className={({ isActive }) => mergeNavItemClass(isActive, '/admin/usuarios', pathname)}
                  onClick={() => setMenuAberto(false)}
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
                  onClick={() => setMenuAberto(false)}
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
      </aside>
    </>
  )
}
