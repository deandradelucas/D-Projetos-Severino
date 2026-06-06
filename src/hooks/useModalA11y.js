import { useEffect, useId } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isFocusableVisible(el) {
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (typeof el.checkVisibility === 'function') {
    try {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    } catch {
      // checkVisibility indisponível em alguns ambientes de teste
    }
  }
  return el.offsetParent !== null || el.getClientRects().length > 0 || el === document.activeElement
}

export function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusableVisible)
}

/**
 * Escape, body scroll lock, horizon-modal-open e focus trap para modais.
 * @param {{ open: boolean, onClose?: () => void, containerRef: React.RefObject<HTMLElement|null>, blockClose?: boolean, autoFocus?: boolean }} opts
 *   autoFocus=false: NÃO move o foco ao abrir (use quando o modal já gerencia o
 *   próprio foco — ex.: focar o input só no desktop, evitando abrir o teclado no
 *   mobile). Mantém scroll-lock + Escape + focus-trap (Tab).
 */
export function useModalA11y({ open, onClose, containerRef, blockClose = false, autoFocus = true }) {
  const titleId = useId()

  // Scroll-lock + foco inicial. Depende SÓ de `open` — assim o foco é dado
  // uma única vez por abertura. Antes, ter `onClose`/`blockClose` nas deps fazia
  // o effect re-rodar a cada re-render do pai (onClose inline = nova referência)
  // e re-focar o 1º elemento, roubando o foco do input → no mobile o teclado
  // fechava sozinho.
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('horizon-modal-open')

    const focusTimer = autoFocus
      ? window.setTimeout(() => {
          const focusable = getFocusableElements(containerRef.current)
          focusable[0]?.focus()
        }, 0)
      : 0

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('horizon-modal-open')
    }
  }, [open, containerRef, autoFocus])

  // Listener de teclado (Escape + focus-trap no Tab). Pode re-bindar quando
  // `onClose`/`blockClose` mudam — é inofensivo, não mexe no foco atual.
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (blockClose) return
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(containerRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = containerRef.current?.contains(active)

      if (event.shiftKey) {
        if (active === first || !inside) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !inside) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, blockClose, containerRef])

  return { titleId }
}
