
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { t } from "@/utils/translations";

export function ThemeLanguageToggle() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        className="w-9 h-9 rounded-full bg-gradient-card border-accent/30 hover:shadow-glow transition-all duration-300 hover:scale-110 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/20 to-accent-purple/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {theme === "dark" ? (
          <Sun className="h-4 w-4 text-accent-orange transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" />
        ) : (
          <Moon className="h-4 w-4 text-accent-blue transition-all duration-300 group-hover:-rotate-12 group-hover:scale-110" />
        )}
        <span className="sr-only">
          {theme === "dark"
            ? t("lightMode", language)
            : t("darkMode", language)}
        </span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLanguage}
        className="h-9 px-3 rounded-full text-sm bg-gradient-secondary hover:shadow-glow transition-all duration-300 hover:scale-105 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent-green/20 to-accent-blue/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="relative z-10 font-medium">
          {language === "en" ? "العربية" : "English"}
        </span>
      </Button>
    </div>
  );
}
