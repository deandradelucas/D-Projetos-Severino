import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('horizonte_theme') || 'light');
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('horizonte_privacy') === 'true');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('horizonte_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('horizonte_privacy', privacyMode);
  }, [privacyMode]);

  const toggleTheme = (newTheme) => setTheme(newTheme);
  const togglePrivacy = () => setPrivacyMode(prev => !prev);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, privacyMode, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
