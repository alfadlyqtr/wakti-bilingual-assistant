
import { Home, CheckSquare, Calendar, Bell, Settings, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();

  const navItems = [
    { 
      icon: Home, 
      label: t("dashboard", language), 
      path: "/dashboard", 
      isActive: location.pathname === "/dashboard" 
    },
    { 
      icon: CheckSquare, 
      label: t("tasks", language), 
      path: "/tasks-reminders", 
      isActive: location.pathname === "/tasks-reminders" || location.pathname === "/tasks" || location.pathname === "/reminders"
    },
    { 
      icon: Calendar, 
      label: t("calendar", language), 
      path: "/calendar", 
      isActive: location.pathname === "/calendar"
    },
    { 
      icon: Users, 
      label: t("contacts", language), 
      path: "/contacts", 
      isActive: location.pathname === "/contacts"
    },
    { 
      icon: Settings, 
      label: t("settings", language), 
      path: "/settings", 
      isActive: location.pathname === "/settings"
    }
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`mobile-nav-item ${item.isActive ? 'active' : ''}`}
        >
          <item.icon className="h-5 w-5" />
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
