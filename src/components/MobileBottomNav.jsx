import { NavLink } from 'react-router-dom'
import { navPrefetchHandlers } from '../lazyRoutes'

const MOBILE_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Início',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect width="7" height="7" x="3" y="3" rx="1.5" />
        <rect width="7" height="7" x="14" y="3" rx="1.5" />
        <rect width="7" height="7" x="14" y="14" rx="1.5" />
        <rect width="7" height="7" x="3" y="14" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/transacoes',
    label: 'Transações',
    end: true,
    className: 'mobile-bottom-nav__item--transactions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 7h10" />
        <path d="M7 12h10" />
        <path d="M7 17h6" />
      </svg>
    ),
  },
  {
    to: '/investimentos',
    label: 'Investimentos',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
        <path d="M14 9h5v5" />
      </svg>
    ),
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19V5" />
        <path d="M8 19v-7" />
        <path d="M12 19V8" />
        <path d="M16 19v-4" />
        <path d="M20 19V9" />
      </svg>
    ),
  },
  {
    to: '/agenda',
    label: 'Agenda',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Ajustes',
    end: true,
    className: 'mobile-bottom-nav__item--settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
]

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
      <div className="mobile-bottom-nav__bar">
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            {...navPrefetchHandlers(item.to)}
            className={({ isActive }) =>
              [
                'mobile-bottom-nav__item',
                item.className,
                isActive ? 'mobile-bottom-nav__item--active' : '',
              ].filter(Boolean).join(' ')
            }
          >
            <span className="mobile-bottom-nav__icon">{item.icon}</span>
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
