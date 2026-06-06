import { useEffect, useRef } from 'react'

/**
 * Swipe-to-reveal (mobile): desliza o elemento para a esquerda revelando ações
 * (ex.: Editar/Excluir) que ficam atrás, à direita. Mesmo padrão da Transação
 * (TransacaoRow): dirige a CSS var `--lc-swipe` e alterna as classes
 * `lc-row--swiping` / `lc-row--revealed`; o CSS é quem desenha o efeito.
 *
 * @param {object} [opts]
 * @param {number} [opts.reveal=72]  largura (px) revelada ao abrir.
 * @param {boolean} [opts.disabled=false]  desliga o gesto.
 * @param {string} [opts.actionsSelector] seletor das ações (toque nelas não fecha).
 * @returns {{ ref, closeIfOpen, posRef }}
 */
export function useSwipeReveal({
  reveal = 72,
  disabled = false,
  actionsSelector = '.page-lista-compras__item-actions',
} = {}) {
  const ref = useRef(null)
  const posRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return
    const s = { startX: 0, startY: 0, axis: null, active: false, opened: false }
    const apply = (x, animate) => {
      el.style.setProperty('--lc-swipe', `${x}px`)
      el.classList.toggle('lc-row--swiping', !animate)
      el.classList.toggle('lc-row--revealed', x <= -reveal / 2)
      posRef.current = x
    }
    const start = (e) => {
      if (e.touches.length !== 1) return
      s.startX = e.touches[0].clientX
      s.startY = e.touches[0].clientY
      s.axis = null
      s.active = true
      s.opened = posRef.current <= -reveal / 2
    }
    const move = (e) => {
      if (!s.active) return
      const dx = e.touches[0].clientX - s.startX
      const dy = e.touches[0].clientY - s.startY
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (s.axis === 'y') { s.active = false; return }
      }
      if (e.cancelable) e.preventDefault()
      const base = s.opened ? -reveal : 0
      apply(Math.max(-reveal, Math.min(0, base + dx)), false)
    }
    const end = () => {
      if (!s.active) return
      s.active = false
      if (s.axis === 'x') apply(posRef.current < -reveal / 2 ? -reveal : 0, true)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [reveal, disabled])

  // Tap fora das ações fecha a linha aberta (sem disparar o clique de baixo)
  const closeIfOpen = (e) => {
    if (posRef.current <= -reveal / 2 && !e.target.closest(actionsSelector)) {
      e.preventDefault()
      e.stopPropagation()
      const el = ref.current
      if (el) {
        el.style.setProperty('--lc-swipe', '0px')
        el.classList.remove('lc-row--swiping', 'lc-row--revealed')
        posRef.current = 0
      }
    }
  }

  return { ref, closeIfOpen, posRef }
}

export default useSwipeReveal
