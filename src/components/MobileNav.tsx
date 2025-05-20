// Update MobileNav.tsx to remove voice summary links
// Only updating the file if it exists and contains voice summary references
// If this file doesn't exist or doesn't contain voice summary references, this will have no effect
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Home, Calendar, CheckSquare, Bell, CalendarClock, Sparkles } from "lucide-react";

export function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Navigation items - removing voice summary
  const navItems = [
    {
      name: language === 'ar' ? 'الرئيسية' : 'Dashboard',
      path: '/dashboard',
      icon: 'home',
    },
    {
      name: language === 'ar' ? 'المهام' : 'Tasks',
      path: '/tasks',
      icon: 'check-square',
    },
    {
      name: language === 'ar' ? 'التقويم' : 'Calendar',
      path: '/calendar',
      icon: 'calendar',
    },
    {
      name: language === 'ar' ? 'التذكيرات' : 'Reminders',
      path: '/reminders',
      icon: 'bell',
    },
    {
      name: language === 'ar' ? 'الأحداث' : 'Events',
      path: '/events',
      icon: 'calendar-clock',
    },
    {
      name: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      path: '/wakti-ai',
      icon: 'sparkles',
    }
  ];
  
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    home: Home,
    calendar: Calendar,
    'check-square': CheckSquare,
    bell: Bell,
    'calendar-clock': CalendarClock,
    sparkles: Sparkles,
  };
  
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-background border-t z-50">
      <ul className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const IconComponent = iconMap[item.icon] || Home;
          const isActive = pathname === item.path;
          
          return (
            <li key={item.path} className="flex-1 flex justify-center">
              <button
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 rounded-md w-full",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
              >
                <IconComponent className="h-5 w-5" />
                <span className="text-xs">{item.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
