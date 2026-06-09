// Ícones SVG da página de Listas (Compras / Tarefas).
// Componentes puros, sem estado — extraídos de ListaDeCompras.jsx.

export function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

// Logo oficial do WhatsApp (Simple Icons / brand mark, viewBox 32×32).
export function IconWhatsApp() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" width="18" height="18" fill="currentColor">
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.83 2.7.83.916 0 2.495-.74 2.838-1.612.13-.33.244-.74.244-1.118 0-.288-.027-.387-.273-.488-.115-.043-2.36-1.135-2.487-1.207-.058-.043-.115-.043-.187-.043z"/>
      <path d="M16.227 3.005C9.05 3.005 3.252 8.804 3.252 15.98c0 2.21.572 4.39 1.665 6.29l-1.943 5.88a.696.696 0 0 0 .9.9l5.88-1.943a12.93 12.93 0 0 0 6.29 1.665c7.176 0 12.975-5.799 12.975-12.975S23.402 3.005 16.227 3.005zm0 23.83c-2.062 0-4.082-.567-5.835-1.643a.696.696 0 0 0-.582-.072l-3.42 1.13 1.13-3.42a.696.696 0 0 0-.072-.582 10.842 10.842 0 0 1-1.643-5.835c0-6.012 4.892-10.905 10.905-10.905 6.012 0 10.905 4.893 10.905 10.905s-4.893 10.422-10.905 10.422z"/>
    </svg>
  )
}

export function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="page-lista-compras__checked-chevron">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconMoreVertical() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function IconSupermercado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
      <path d="M2 4h2l2.4 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6" />
    </svg>
  )
}

export function IconChecklist() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 7 2 2 3-3" />
      <path d="m3 16 2 2 3-3" />
      <path d="M12 8h9" />
      <path d="M12 17h9" />
    </svg>
  )
}

export function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

export function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  )
}

export function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16a1 1 0 0 1 1 1v3" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  )
}

export function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
