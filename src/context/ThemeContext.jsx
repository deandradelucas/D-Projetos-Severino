import React, { createContext, useContext, useState, useLayoutEffect, useEffect } from 'react'

const ThemeContext = createContext()

const STORAGE_KEY = 'horizonte_theme'

const VALID_THEMES = ['light', 'dark', 'glass']

const THEME_COLOR_META = {
  light: '#8ca8d4',
  dark: '#050607',
  glass: '#0a1524',
}

function normalizeTheme(raw) {
  if (raw === 'light' || raw === 'dark' || raw === 'glass') return raw
  if (raw === 'cyberpunk' || raw === 'off-white') return 'dark'
  return 'light'
}

function readStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'light'
  }
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  document.body.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore quota / private mode */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLOR_META[theme] ?? THEME_COLOR_META.light)
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme())
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('horizonte_privacy') === 'true')

  useLayoutEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('horizonte_privacy', privacyMode ? 'true' : 'false')
  }, [privacyMode])

  const setTheme = (next) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
  }

  const toggleTheme = () =>
    setThemeState((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'glass' : 'light'))
  const togglePrivacy = () => setPrivacyMode((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, privacyMode, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto
export const useTheme = () => useContext(ThemeContext)
