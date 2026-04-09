import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();
const FIXED_THEME = 'light';

export function ThemeProvider({ children }) {
  const [theme] = useState(FIXED_THEME);
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('horizonte_privacy') === 'true');

  useEffect(() => {
    document.body.setAttribute('data-theme', FIXED_THEME);
    localStorage.setItem('horizonte_theme', FIXED_THEME);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('horizonte_privacy', privacyMode);
  }, [privacyMode]);

  // Temas removidos: mantemos função por compatibilidade com componentes existentes.
  const toggleTheme = () => {};
  const togglePrivacy = () => setPrivacyMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, privacyMode, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook separado do Provider: fast refresh exige arquivo só com componentes.
// eslint-disable-next-line react-refresh/only-export-components -- hook do mesmo contexto
export const useTheme = () => useContext(ThemeContext);
