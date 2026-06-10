import React, { createContext, useContext, useState, useLayoutEffect, useEffect } from 'react'

const ThemeContext = createContext()

const STORAGE_KEY = 'horizonte_theme'

/** Temas efetivos aplicados ao documento. */
const VALID_THEMES = ['light', 'dark']
/** Preferências que o usuário pode escolher (system = seguir o sistema). */
const VALID_PREFS = ['light', 'dark', 'system']

/** Cor da UI do sistema (PWA / Chrome). Claro = branco para alinhar ao shell e evitar faixa escura na área do gesto (Android). */
const THEME_COLOR_META = {
  light: '#ffffff',
  dark: '#000000',
}

const prefersDarkQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Resolve a preferência para um tema efetivo (light/dark). */
function resolveTheme(pref) {
  if (pref === 'system') return prefersDarkQuery()?.matches ? 'dark' : 'light'
  return VALID_THEMES.includes(pref) ? pref : 'light'
}

/** Remove valores legados (não suportados). */
function purgeLegacyThemeStorage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && !VALID_PREFS.includes(v)) {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* quota / private mode */
  }
}

function readStoredPref() {
  purgeLegacyThemeStorage()
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && VALID_PREFS.includes(v)) return v
  } catch {
    /* ignore */
  }
  return 'light'
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  document.body.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLOR_META[theme] ?? THEME_COLOR_META.light)
  }
}

export function ThemeProvider({ children }) {
  const [themePref, setThemePrefState] = useState(() => readStoredPref())
  const [theme, setThemeEffective] = useState(() => resolveTheme(readStoredPref()))
  const [privacyMode, setPrivacyMode] = useState(() => {
    try {
      return localStorage.getItem('horizonte_privacy') === 'true'
    } catch {
      return false
    }
  })

  // Persiste a preferência e recalcula o tema efetivo.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePref)
    } catch {
      /* ignore */
    }
    setThemeEffective(resolveTheme(themePref))
  }, [themePref])

  // Quando a preferência é "system", acompanha mudanças do sistema operacional.
  useEffect(() => {
    if (themePref !== 'system') return undefined
    const mq = prefersDarkQuery()
    if (!mq) return undefined
    const onChange = () => setThemeEffective(mq.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [themePref])

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

  // setTheme aceita 'light' | 'dark' | 'system' (mantém compatibilidade com chamadas antigas).
  const setTheme = (t) => {
    if (!VALID_PREFS.includes(t)) return
    setThemePrefState(t)
  }

  const toggleTheme = () => {
    setThemePrefState((prev) => (resolveTheme(prev) === 'light' ? 'dark' : 'light'))
  }

  const togglePrivacy = () => setPrivacyMode((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ theme, themePref, setTheme, toggleTheme, privacyMode, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto
export const useTheme = () => useContext(ThemeContext)
