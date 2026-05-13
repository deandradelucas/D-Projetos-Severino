function EyeIcons({ hidden }) {
  if (hidden) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.4 10.4 0 0112 5c5 0 9.3 3.8 10 9-.3 1.8-1 3.5-2 4.9M6.1 6.1C4.3 7.7 3 9.7 2 12c.7 5.2 5 9 10 9 1.6 0 3.1-.4 4.5-1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M2 12s4.5-7 10-7 10 7 10 7-4.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * Botão “mostrar/ocultar senha” usado em Login e Cadastro (ícone olho).
 */
export default function AuthPasswordToggleButton({
  passwordVisible,
  onToggle,
  ariaLabelShow = 'Mostrar senha',
  ariaLabelHide = 'Ocultar senha',
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={passwordVisible ? ariaLabelHide : ariaLabelShow}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] sm:right-3"
    >
      <EyeIcons hidden={passwordVisible} />
    </button>
  )
}
