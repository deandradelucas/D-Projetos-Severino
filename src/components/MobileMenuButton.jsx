export default function MobileMenuButton({
  onClick,
  isOpen = false,
  className = 'mobile-menu-btn',
  'aria-label': ariaLabel = 'Abrir menu',
  ...props
}) {
  return (
    <button
      type="button"
      className={`${className}${isOpen ? ' mobile-menu-btn--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Fechar menu' : ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      {...props}
    >
      <span className="mobile-menu-btn__bar" />
      <span className="mobile-menu-btn__bar" />
      <span className="mobile-menu-btn__bar" />
    </button>
  )
}
