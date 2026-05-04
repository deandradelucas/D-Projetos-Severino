import { useEffect, useId, useRef, useState } from 'react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  const titleId = useId()
  const messageId = useId()
  const confirmButtonRef = useRef(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('horizon-modal-open')
    const focusTimer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0)

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !pending) onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('horizon-modal-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open, pending])

  if (!open) return null

  const handleConfirm = async () => {
    if (pending) return
    setPending(true)
    try {
      await onConfirm?.()
      onClose?.()
    } finally {
      setPending(false)
    }
  }

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget && !pending) onClose?.()
  }

  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className={`confirm-dialog confirm-dialog--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="confirm-dialog__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <div className="confirm-dialog__body">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
        </div>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__btn confirm-dialog__btn--secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--danger"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
