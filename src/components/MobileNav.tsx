
import { useNavigate, useLocation } from "react-router-dom";
import { Home, List, Calendar, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  
  const navItems = [
    {
      icon: Home,
      label: "dashboard",
      path: "/dashboard",
    },
    {
      icon: List,
      label: "taskManagement",
      path: "/tasks",
    },
    {
      icon: Calendar,
      label: "calendar",
      path: "/calendar",
    },
    {
      icon: MessageSquare,
      label: "messaging",
      path: "/messages",
    },
    {
      icon: User,
      label: "profile",
      path: "/profile",
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
