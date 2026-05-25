import { NavLink } from 'react-router-dom'
import { navPrefetchHandlers } from '../lazyRoutes'
import { MAIN_NAV_ITEMS } from '../lib/navItems'

const ICON_PROPS = { strokeWidth: '1.8' }

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
      <div className="mobile-bottom-nav__bar">
        {MAIN_NAV_ITEMS.filter((item) => !item.mobileHide).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            {...navPrefetchHandlers(item.to)}
            className={({ isActive }) =>
              [
                'mobile-bottom-nav__item',
                item.mobileClassName,
                isActive ? 'mobile-bottom-nav__item--active' : '',
              ].filter(Boolean).join(' ')
            }
          >
            <span className="mobile-bottom-nav__icon">{item.icon(ICON_PROPS)}</span>
            <span className="mobile-bottom-nav__label">{item.mobileLabel ?? item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
