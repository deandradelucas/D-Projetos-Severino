import React, { createContext, useContext, useState, useLayoutEffect, useEffect } from 'react'

const ThemeContext = createContext()

const STORAGE_KEY = 'horizonte_theme'

const VALID_THEMES = ['light', 'dark']

/** Cor da UI do sistema (PWA / Chrome). Claro = branco para alinhar ao shell e evitar faixa escura na área do gesto (Android). */
const THEME_COLOR_META = {
  light: '#ffffff',
  dark: '#000000',
}

/** Fundo aplicado imperativamente no <html> — DEVE espelhar o CSS `html {}` /
 *  `html:has(body[data-theme='light'])` para que o safe-area (status bar no PWA)
 *  fique idêntico ao estado correto pós-relaunch, sem emenda de cor. */
const ROOT_BG = {
  light: '#ffffff',
  dark: '#080a0c',
}

/** Remove valores legados (temas antigos não suportados). */
function purgeLegacyThemeStorage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && !VALID_THEMES.includes(v)) {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* quota / private mode */
  }
}

function readStoredTheme() {
  purgeLegacyThemeStorage()
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && VALID_THEMES.includes(v)) return v
  } catch {
    /* ignore */
  }
  return 'light'
}

/**
 * Recria a meta theme-color do zero. Em alguns WebKit (iOS PWA standalone),
 * apenas mudar o `content` não força a UI do sistema a reavaliar a cor — remover
 * e reinserir o elemento nudga o repaint da barra de status.
 */
function refreshThemeColorMeta(color) {
  const head = document.head
  if (!head) return
  const old = head.querySelector('meta[name="theme-color"]')
  if (old) old.remove()
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', color)
  head.appendChild(meta)
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const color = THEME_COLOR_META[theme] ?? THEME_COLOR_META.light

  document.body.setAttribute('data-theme', theme)
  // Espelha o tema no <html> para permitir seletores diretos (html[data-theme])
  // sem depender de :has() — o iOS não repinta o safe-area quando o fundo do root
  // muda só por cascata :has() em runtime (corrige apenas no relaunch).
  root.setAttribute('data-theme', theme)

  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }

  refreshThemeColorMeta(color)

  // iOS PWA: pinta o <html> imperativamente (fundo do safe-area/status bar) e
  // força um reflow síncrono para o WebKit repintar o topo na hora da troca,
  // em vez de só no próximo relaunch do app.
  // (O `!important` da rota BemVindoAssinatura continua prevalecendo sobre este inline.)
  root.style.backgroundColor = ROOT_BG[theme] ?? ROOT_BG.light
  void root.offsetHeight
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme())
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('horizonte_privacy') === 'true'
    } catch {
      return false
    }
  })

  useLayoutEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem('horizonte_privacy', privacyMode ? 'true' : 'false')
    } catch {
      /* quota / private mode */
    }
  }, [privacyMode])

  const setTheme = (t) => {
    if (!VALID_THEMES.includes(t)) return
    setThemeState(t)
  }

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const togglePrivacy = () => setPrivacyMode((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, privacyMode, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto
export const useTheme = () => useContext(ThemeContext)
