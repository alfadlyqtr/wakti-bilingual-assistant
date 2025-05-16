
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarDays, CheckCircle, Mic, CalendarHeart, Sparkles } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all scale-100 hover:scale-110",
        isActive
          ? isDark 
            ? "text-white" 
            : "text-light-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "rounded-full p-1.5 mb-0.5 transition-all",
          isActive && (
            isDark
              ? "bg-gradient-to-br from-dark-secondary to-dark-tertiary shadow-lg shadow-dark-secondary/20"
              : "bg-gradient-to-br from-light-primary/80 to-light-secondary shadow-lg shadow-light-secondary/20"
          ),
          !isActive && "hover:bg-accent/50"
        )}
      >
        {icon}
      </div>
      <span className={cn(
        "text-[10px] font-medium transition-all", 
        isActive && "font-semibold"
      )}>
        {label}
      </span>
    </button>
  );
};

export const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useTheme();
  const path = location.pathname;
  const isDark = theme === "dark";

  const navItems = [
    {
      icon: <CalendarDays className="h-5 w-5" />,
      label: t("calendar", language),
      path: "/calendar",
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      label: t("tasks", language),
      path: "/tasks",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      label: t("ai", language),
      path: "/wakti-ai",
    },
    {
      icon: <Mic className="h-5 w-5" />,
      label: t("summary", language),
      path: "/voice-summary",
    },
    {
      icon: <CalendarHeart className="h-5 w-5" />,
      label: t("events", language),
      path: "/events",
    },
  ];

  // Don't show nav on auth screens
  if (path === "/login" || path === "/signup" || path === "/forgot-password" || path === "/") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-2 right-2 z-50">
      <div className={cn(
        "flex justify-around items-center p-0.5 mx-auto max-w-md rounded-full border shadow-xl animate-fade-in",
        isDark 
          ? "bg-dark-bg/90 backdrop-blur-xl border-dark-secondary/30 shadow-dark-bg/30" 
          : "bg-light-bg/90 backdrop-blur-xl border-light-secondary/40 shadow-light-secondary/20"
      )}>
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            isActive={path === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </div>
  );
};
