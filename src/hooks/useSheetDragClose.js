import { useEffect } from 'react'

/**
 * Drag-to-close para modais bottom-sheet no mobile.
 * Arrastar o sheet pra baixo (a partir do topo do scroll) desliza e fecha.
 *
 * @param {React.RefObject<HTMLElement>} sheetRef — ref do elemento `.modal-content` (o scroller)
 * @param {{ open: boolean, onClose: () => void, isDirty?: () => boolean }} opts
 *   - open: se o modal está aberto (liga/desliga os listeners)
 *   - onClose: fecha o modal (pode conter confirm de descarte)
 *   - isDirty: opcional; se retornar true, confirma antes (sem deslizar pra fora)
 *
 * Requer as classes CSS `.sheet-dragging` / `.sheet-closing` + var `--sheet-drag`
 * (partial 31). Só atua em telas ≤768px.
 */
export function useSheetDragClose(sheetRef, { open, onClose, isDirty } = {}) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined
    if (!window.matchMedia('(max-width: 768px)').matches) return undefined
    const sheet = sheetRef.current
    if (!sheet) return undefined

    let startY = 0
    let active = false
    let decided = false
    let dy = 0
    const THRESHOLD = 110

    const setDrag = (px) => sheet.style.setProperty('--sheet-drag', `${px}px`)
    const animateTo = (target, after) => {
      sheet.classList.remove('sheet-dragging')
      sheet.classList.add('sheet-closing')
      requestAnimationFrame(() => {
        setDrag(target)
        window.setTimeout(after, 300)
      })
    }

    const onStart = (e) => {
      if (e.touches.length !== 1) return
      startY = e.touches[0].clientY
      active = sheet.scrollTop <= 0
      decided = false
      dy = 0
    }
    const onMove = (e) => {
      if (!active) return
      dy = e.touches[0].clientY - startY
      if (!decided) {
        if (Math.abs(dy) < 6) return
        if (dy < 0 || sheet.scrollTop > 0) { active = false; return }
        decided = true
        sheet.classList.add('sheet-dragging')
      }
      if (dy > 0) {
        if (e.cancelable) e.preventDefault()
        setDrag(dy)
      }
    }
    const finish = () => {
      if (!active || !decided) { active = false; return }
      active = false
      if (dy > THRESHOLD) {
        if (typeof isDirty === 'function' && isDirty()) {
          onClose()
          animateTo(0, () => sheet.classList.remove('sheet-closing'))
        } else {
          animateTo(window.innerHeight, () => onClose())
        }
      } else {
        animateTo(0, () => sheet.classList.remove('sheet-closing'))
      }
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', finish, { passive: true })
    sheet.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', finish)
      sheet.removeEventListener('touchcancel', finish)
      sheet.classList.remove('sheet-dragging', 'sheet-closing')
      sheet.style.removeProperty('--sheet-drag')
    }
  }, [open, onClose, isDirty, sheetRef])
}
