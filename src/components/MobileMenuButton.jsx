export default function MobileMenuButton({
  onClick,
  className = 'mobile-menu-btn',
  'aria-label': ariaLabel = 'Abrir menu',
  ...props
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="18" y2="18" />
      </svg>
    </button>
  )
}
