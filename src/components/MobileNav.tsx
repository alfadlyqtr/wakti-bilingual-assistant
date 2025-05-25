
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { 
  CheckSquare, 
  Calendar, 
  Bell, 
  MessageCircle, 
  LayoutDashboard
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();

  const navItems = [
    { icon: LayoutDashboard, label: t("dashboard", language), path: "/dashboard" },
    { icon: CheckSquare, label: t("tasks", language), path: "/tasks" },
    { icon: Calendar, label: t("calendar", language), path: "/calendar" },
    { icon: Bell, label: t("reminders", language), path: "/reminders" },
    { icon: MessageCircle, label: t("messages", language), path: "/messages" },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <Button
            key={item.path}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 h-auto py-2 ${
              isActive ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon size={18} />
            <span className="text-xs">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
