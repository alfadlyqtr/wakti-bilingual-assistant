
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles } from "lucide-react";

export function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Navigation items - removed Tasks & Reminders
  const navItems = [
    {
      name: language === 'ar' ? 'التقويم' : 'Calendar',
      path: '/calendar',
      icon: 'calendar',
    },
    {
      name: language === 'ar' ? 'مواعيد' : 'Maw3d',
      path: '/maw3d',
      icon: 'calendar-clock',
    },
    {
      name: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      path: '/wakti-ai',
      icon: 'sparkles',
    },
    {
      name: language === 'ar' ? 'تسجيل' : 'Tasjeel',
      path: '/tasjeel',
      icon: 'mic',
    }
  ];
  
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    calendar: Calendar,
    'calendar-clock': CalendarClock,
    sparkles: Sparkles,
    mic: Mic,
  };
  
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-background border-t z-50">
      <ul className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const IconComponent = iconMap[item.icon] || Calendar;
          const isActive = pathname === item.path || (item.path === '/maw3d' && pathname.startsWith('/maw3d'));
          
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
