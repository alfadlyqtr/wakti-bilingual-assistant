import { createContext, ReactNode, useState } from 'react';

interface ThemeContextType {
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [language, setLanguageState] = useState<'en' | 'ar'>(() => {
    try { const v = localStorage.getItem('wakti_language'); return (v === 'ar' || v === 'en') ? v : 'en'; } catch { return 'en'; }
  });
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try { const v = localStorage.getItem('wakti_theme'); return (v === 'light' || v === 'dark') ? v : 'dark'; } catch { return 'dark'; }
  });

  const setLanguage = (lang: 'en' | 'ar') => {
    setLanguageState(lang);
    try { localStorage.setItem('wakti_language', lang); } catch {}
  };

  const setTheme = (t: 'light' | 'dark') => {
    setThemeState(t);
    try { localStorage.setItem('wakti_theme', t); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ language, setLanguage, theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
