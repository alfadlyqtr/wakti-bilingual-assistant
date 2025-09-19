import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";
type Language = "en" | "ar";

interface ThemeContextType {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
}

const defaultContextValue: ThemeContextType = {
  theme: "light",
  language: "en",
  setTheme: () => null,
  setLanguage: () => null,
  toggleTheme: () => null,
  toggleLanguage: () => null,
};

const ThemeContext = createContext<ThemeContextType>(defaultContextValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    const storedLanguage = localStorage.getItem("language") as Language | null;
    
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
    
    if (storedLanguage) {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("language", language);
    // Keep the app layout LTR regardless of language; only change language metadata
    document.documentElement.setAttribute("lang", language);
    document.documentElement.classList.remove("rtl");
    document.dir = "ltr";
  }, [language]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const toggleLanguage = () => {
    setLanguage((prevLang) => (prevLang === "en" ? "ar" : "en"));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        language,
        setTheme,
        setLanguage,
        toggleTheme,
        toggleLanguage,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
