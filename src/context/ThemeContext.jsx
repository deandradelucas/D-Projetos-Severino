import React, { createContext, useContext, useState, useLayoutEffect, useEffect } from 'react'

const ThemeContext = createContext()

const STORAGE_KEY = 'horizonte_theme'

const VALID_THEMES = ['light', 'dark', 'glass']

const THEME_COLOR_META = {
  light: '#8ca8d4',
  dark: '#030303',
  glass: '#030303',
}

/** Remove valores legados (cyberpunk, off-white, etc.). */
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

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  document.body.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
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

  const setTheme = (t) => {
    if (!VALID_THEMES.includes(t)) return
    setThemeState(t)
  }

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'glass' : 'light'))
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
