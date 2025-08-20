import React, { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, Moon, Sun } from "lucide-react";
import { t } from "@/utils/translations";
import { Logo3D } from "@/components/Logo3D";
import { LogOut } from "lucide-react";

export default function SessionEnded() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, language, toggleLanguage } = useTheme();

  useEffect(() => {
    // Best-effort cleanup if flag still exists
    try { localStorage.removeItem("wakti_session_kicked"); } catch {}
  }, []);

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4 relative">
      {/* Top-right quick toggles (language + theme) */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={toggleLanguage}
                className="rounded-full h-8 w-8 p-0"
                aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="rounded-full h-8 w-8 p-0 relative"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <div className="w-full max-w-md bg-card/40 border rounded-xl p-6 shadow-soft">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative mb-6">
            <div className="relative">
              <Logo3D size="md" className="opacity-80" />
              <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground p-1.5 rounded-full border-2 border-background shadow-sm">
                <LogOut className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">{t("sessionEnded_title", language)}</h1>
            <p className="text-muted-foreground text-sm">
              {t("sessionEnded_message", language)}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center pt-1 w-full">
            <Button 
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => navigate("/login", { replace: true, state: { from: location } })}
            >
              {t("sessionEnded_goToLogin", language)}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => navigate("/home", { replace: true })}
            >
              {t("sessionEnded_goToHome", language)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
