import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    document.documentElement.setAttribute("lang", language);
    
    // Keep overall app layout LTR for all languages.
    // Arabic will still get right-aligned text via css rules on [lang="ar"],
    // but we no longer flip the entire document direction.
    document.dir = "ltr";
    
    // Sync language to database for push notifications (fire-and-forget, non-blocking)
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          // Cast needed until types are regenerated with new language column
          await (supabase.from("profiles") as any).update({ language }).eq("id", user.id);
        }
      } catch {
        // Silent fail - localStorage is the source of truth for UI
      }
    })();
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
