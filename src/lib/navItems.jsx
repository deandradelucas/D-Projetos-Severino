/**
 * Itens de navegação compartilhados entre Sidebar e MobileBottomNav.
 * Cada `icon` é uma função que aceita props SVG extras (strokeWidth, width, height).
 *
 * `section` agrupa os itens na Sidebar (desktop/drawer):
 *   'principal' | 'financas' | 'organizacao' | 'conta'
 * O MobileBottomNav ignora `section` (usa só to/end/icon/mobileLabel/mobileHide).
 */
export const MAIN_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    mobileLabel: 'Início',
    section: 'principal',
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
    section: 'financas',
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
    to: '/cartoes',
    label: 'Cartões',
    section: 'financas',
    end: true,
    mobileHide: true,
    title: 'Cartões de crédito — faturas, fechamento e vencimento',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2.5" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
  {
    to: '/investimentos',
    label: 'Investimentos',
    section: 'financas',
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
    to: '/metas',
    label: 'Metas',
    section: 'financas',
    end: true,
    mobileHide: true,
    title: 'Objetivos financeiros — junte dinheiro e acompanhe o progresso',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    section: 'financas',
    end: true,
    mobileHide: true,
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
    section: 'organizacao',
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
    label: 'Listas',
    mobileLabel: 'Listas',
    section: 'organizacao',
    end: true,
    title: 'Suas listas — compras e tarefas',
    icon: (props) => (
      // Carrinho redesenhado dentro da área óptica 3..21 (o original ia de 1 a 23
      // e parecia maior/mais baixo que os vizinhos na bottom-nav — desalinhava).
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <circle cx="9.5" cy="19.5" r="1.1" />
        <circle cx="17.5" cy="19.5" r="1.1" />
        <path d="M3.5 4.5h2.6l2.2 9.8a2 2 0 0 0 2 1.55h6.9a2 2 0 0 0 1.95-1.53L20.7 8.5H7" />
      </svg>
    ),
  },
  {
    to: '/pagamento',
    label: 'Pagamento',
    section: 'conta',
    end: true,
    mobileHide: true,
    title: 'Pagamento — assinatura mensal (Asaas)',
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Ajustes',
    section: 'conta',
    end: true,
    mobileHide: true,
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
