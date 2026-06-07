import { useState, useEffect } from 'react'

// Detecta a altura do teclado virtual via visualViewport API.
// Retorna 0 quando o teclado está fechado (ou < 80px de variação).
export function useKeyboardOffset() {
  const [keyboardH, setKeyboardH] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardH(kh > 80 ? kh : 0)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return keyboardH
}
