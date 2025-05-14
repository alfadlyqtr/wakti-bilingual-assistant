
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
        "flex flex-col items-center justify-center p-2 rounded-lg transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "rounded-full p-2 mb-1",
          isActive &&
            (isDark
              ? "bg-gradient-to-tr from-primary/20 to-primary/10"
              : "bg-primary/10")
        )}
      >
        {icon}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};

export const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme } = useTheme();
  const path = location.pathname;

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
      path: "/assistant",
    },
    {
      icon: <Mic className="h-5 w-5" />,
      label: t("summary", language),
      path: "/voice",
    },
    {
      icon: <CalendarHeart className="h-5 w-5" />,
      label: t("events", language),
      path: "/events",
    },
  ];

  return (
    <div className="fixed bottom-4 left-2 right-2 z-50 bg-background/80 backdrop-blur-lg rounded-xl shadow-xl border border-border/30">
      <div className="flex justify-around items-center p-1">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            isActive={path.startsWith(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </div>
  );
};
