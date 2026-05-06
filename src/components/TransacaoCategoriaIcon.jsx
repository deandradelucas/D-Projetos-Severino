import React from 'react'
import { getTransacaoCategoriaIconKey } from '../lib/transacaoCategoriaIconResolve.js'

const stroke = {
  width: '2.25',
  cap: 'round',
  join: 'round',
}

function Svg({ size, children, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.width}
      strokeLinecap={stroke.cap}
      strokeLinejoin={stroke.join}
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

const ICON_RENDERERS = {
  arrowUp: (size) => (
    <Svg size={size}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </Svg>
  ),
  arrowDown: (size) => (
    <Svg size={size}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Svg>
  ),
  utensils: (size) => (
    <Svg size={size}>
      <path d="M3 2v7c0 1.1.9 2 2 2h1" />
      <path d="M7 2v9" />
      <path d="M14 15V2v0a5 5 0 0 1 5 5v6c0 1.1-.9 2-2 2h-1" />
      <path d="M15 15v3a2 2 0 0 0 2 2h1" />
    </Svg>
  ),
  car: (size) => (
    <Svg size={size}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </Svg>
  ),
  fuel: (size) => (
    <Svg size={size}>
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M7 22V10h6v12" />
      <path d="M17 12h2a2 2 0 0 0 2-2V8h-4v4" />
      <path d="M17 8h-2" />
    </Svg>
  ),
  home: (size) => (
    <Svg size={size}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  ),
  health: (size) => (
    <Svg size={size}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  ),
  education: (size) => (
    <Svg size={size}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </Svg>
  ),
  leisure: (size) => (
    <Svg size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 8 2 2 4-4" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </Svg>
  ),
  shopping: (size) => (
    <Svg size={size}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Svg>
  ),
  tech: (size) => (
    <Svg size={size}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </Svg>
  ),
  subscription: (size) => (
    <Svg size={size}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </Svg>
  ),
  fitness: (size) => (
    <Svg size={size}>
      <path d="M6.5 6.5h11" />
      <path d="M6.5 17.5h11" />
      <path d="M8 6.5v11" />
      <path d="M16 6.5v11" />
      <path d="M3 10h3" />
      <path d="M18 10h3" />
      <path d="M3 14h3" />
      <path d="M18 14h3" />
    </Svg>
  ),
  receipt: (size) => (
    <Svg size={size}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6" />
      <path d="M16 12h-6" />
      <path d="M10 16h6" />
    </Svg>
  ),
  pet: (size) => (
    <Svg size={size}>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4a5 5 0 0 1 3-4.6" />
      <path d="M5 15a3 3 0 0 0-1 5.2" />
    </Svg>
  ),
  plane: (size) => (
    <Svg size={size}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.3-.8.8L8 16l-2 3c-.3.4-.2 1 .3 1.3l2.3 1.3c.4.2 1 .1 1.3-.3l2-3 9.2 1.8c.5.1 1-.3.8-.8Z" />
    </Svg>
  ),
  gift: (size) => (
    <Svg size={size}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </Svg>
  ),
  wallet: (size) => (
    <Svg size={size}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </Svg>
  ),
  work: (size) => (
    <Svg size={size}>
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Svg>
  ),
  investment: (size) => (
    <Svg size={size}>
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="m13 13 6 6" />
    </Svg>
  ),
  child: (size) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </Svg>
  ),
  bank: (size) => (
    <Svg size={size}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
    </Svg>
  ),
}

/**
 * Ícone da linha de transação: categoria/subcategoria ou seta receita/despesa.
 */
export function TransacaoCategoriaIcon({ categoriaNome, subcategoriaNome, isReceita, size = 16, className }) {
  const key = getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome)
  const render =
    key && ICON_RENDERERS[key]
      ? ICON_RENDERERS[key]
      : isReceita
        ? ICON_RENDERERS.arrowUp
        : ICON_RENDERERS.arrowDown
  const svg = render(size)
  return className ? <span className={className}>{svg}</span> : svg
}
