/**
 * Itens de navegação compartilhados entre Sidebar e MobileBottomNav.
 * Cada `icon` é uma função que aceita props SVG extras (strokeWidth, width, height).
 */
export const MAIN_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    mobileLabel: 'Início',
    end: true,
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
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
    mobileClassName: 'mobile-bottom-nav__item--transactions',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
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
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
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
    title: 'Gráficos, resumo do período e exportação CSV ou PDF',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
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
    title: 'Compromissos, lembretes e interação via WhatsApp',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
      </svg>
    ),
  },
  {
    to: '/lista-de-compras',
    label: 'Lista de compras',
    mobileLabel: 'Compras',
    end: true,
    title: 'Itens a comprar — pessoal ou da família',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Ajustes',
    end: true,
    title: 'Perfil, tema, biometria e dados',
    sidebarClassName: 'nav-item--settings',
    mobileClassName: 'mobile-bottom-nav__item--settings',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
]
