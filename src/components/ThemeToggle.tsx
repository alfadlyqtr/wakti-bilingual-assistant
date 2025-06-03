
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, language, toggleTheme } = useTheme();

  return (
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
          ? (language === "en" ? "Light Mode" : "الوضع الفاتح")
          : (language === "en" ? "Dark Mode" : "الوضع الداكن")}
      </span>
    </Button>
  );
}
