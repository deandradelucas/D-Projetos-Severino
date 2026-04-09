import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/dashboard', label: 'Visão Geral', icon: '◫' },
  { to: '/transacoes', label: 'Transações', icon: '$' },
  { to: '/relatorios', label: 'Relatórios', icon: '◔' },
  { to: '/pagamento', label: 'Plano', icon: '◈' },
  { to: '/configuracoes', label: 'Ajustes', icon: '⚙' },
]

export default function ExecutiveMobileNav() {
  return (
    <nav className="exec-mobile-nav" aria-label="Navegação rápida">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `exec-mobile-nav__item ${isActive ? 'is-active' : ''}`}>
          <span className="exec-mobile-nav__icon" aria-hidden>{item.icon}</span>
          <span className="exec-mobile-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
