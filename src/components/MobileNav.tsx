import React from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Home as HomeIcon, Calendar as CalendarIcon, Clipboard as ClipboardIcon, PartyPopper as PartyIcon, Sparkles as SparklesIcon } from "lucide-react";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, to, isActive }) => {
  return (
    <a href={to} className="flex flex-col items-center justify-center space-y-1">
      <div className="relative">
        {icon}
        {isActive && (
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-ping"></div>
        )}
      </div>
      <span className="text-xs">{label}</span>
    </a>
  );
};

export const MobileNav: React.FC = () => {
  const location = useLocation();
  const { language } = useTheme();
  
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-10">
      <div className="flex justify-around py-2 px-1 items-center">
        <NavItem
          to="/"
          label={t("home", language)}
          icon={<HomeIcon className={isActive("/") ? "fill-primary" : ""} />}
          isActive={isActive("/")}
        />
        <NavItem
          to="/calendar"
          label={t("calendar", language)}
          icon={<CalendarIcon className={isActive("/calendar") ? "fill-primary" : ""} />}
          isActive={isActive("/calendar")}
        />
        <NavItem
          to="/tasks"
          label={t("tasks", language)}
          icon={<ClipboardIcon className={isActive("/tasks") ? "fill-primary" : ""} />}
          isActive={isActive("/tasks")}
        />
        <NavItem
          to="/events"
          label={t("events", language)}
          icon={<PartyIcon className={isActive("/events") ? "fill-primary" : ""} />}
          isActive={isActive("/events")}
        />
        <NavItem
          to="/ai-assistant"
          label={t("assistant", language)}
          icon={<SparklesIcon className={isActive("/ai-assistant") ? "fill-primary" : ""} />}
          isActive={isActive("/ai-assistant")}
        />
      </div>
    </nav>
  );
};
