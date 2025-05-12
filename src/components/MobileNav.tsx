
import { useNavigate, useLocation } from "react-router-dom";
import { Home, ListCheck, Calendar, Mic, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  
  const navItems = [
    {
      icon: Home,
      label: "dashboard" as TranslationKey,
      path: "/dashboard",
    },
    {
      icon: ListCheck,
      label: "taskManagement" as TranslationKey,
      path: "/tasks",
    },
    {
      icon: Calendar,
      label: "calendar" as TranslationKey,
      path: "/calendar",
    },
    {
      icon: Mic,
      label: "waktiAssistant" as TranslationKey,
      path: "/assistant",
    },
    {
      icon: BarChart2,
      label: "voiceSummary" as TranslationKey,
      path: "/voice-summary",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t border-border">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={cn(
                "flex flex-col items-center justify-center py-3 px-2 w-1/5",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{t(item.label, language)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
