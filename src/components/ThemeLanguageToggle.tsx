
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Sun } from "lucide-react";

export function ThemeLanguageToggle() {
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        className="w-9 h-9 rounded-full"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">
          {theme === "dark"
            ? (language === "en" ? "Light Mode" : "الوضع الفاتح")
            : (language === "en" ? "Dark Mode" : "الوضع الداكن")}
        </span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLanguage}
        className="h-9 px-3 rounded-full text-sm"
      >
        {language === "en" ? "العربية" : "English"}
      </Button>
    </div>
  );
}
