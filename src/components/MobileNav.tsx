
import React from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Calendar, ClipboardList, Sparkles, Mic, PartyPopper } from "lucide-react";

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
    if (path === "/calendar") {
      return location.pathname === "/calendar";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-5 left-0 right-0 mx-auto max-w-sm z-10">
      <div className="flex justify-around py-3 px-4 mx-4 rounded-full bg-background/80 backdrop-blur-lg border border-border shadow-lg">
        <NavItem
          to="/calendar"
          label={t("calendar", language)}
          icon={<Calendar className={isActive("/calendar") ? "fill-primary" : ""} />}
          isActive={isActive("/calendar")}
        />
        <NavItem
          to="/tasks"
          label={t("tasks", language)}
          icon={<ClipboardList className={isActive("/tasks") ? "fill-primary" : ""} />}
          isActive={isActive("/tasks")}
        />
        <NavItem
          to="/ai-assistant"
          label={t("assistant", language)}
          icon={<Sparkles className={isActive("/ai-assistant") ? "fill-primary" : ""} />}
          isActive={isActive("/ai-assistant")}
        />
        <NavItem
          to="/voice-summary"
          label={t("summary", language)}
          icon={<Mic className={isActive("/voice-summary") ? "fill-primary" : ""} />}
          isActive={isActive("/voice-summary")}
        />
        <NavItem
          to="/events"
          label={t("events", language)}
          icon={<PartyPopper className={isActive("/events") ? "fill-primary" : ""} />}
          isActive={isActive("/events")}
        />
      </div>
    </nav>
  );
};
