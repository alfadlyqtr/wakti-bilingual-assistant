import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles, ListTodo } from "lucide-react";

export function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  // Navigation items - Updated with vibrant colors and animations
  const navItems = [
    {
      name: language === 'ar' ? 'التقويم' : 'Calendar',
      path: '/calendar',
      icon: 'calendar',
      colorClass: 'nav-icon-calendar',
    },
    {
      name: language === 'ar' ? 'مواعيد' : 'Maw3d',
      path: '/maw3d',
      icon: 'calendar-clock',
      colorClass: 'nav-icon-maw3d',
    },
    {
      name: language === 'ar' ? 'م & ت' : 'T & R',
      path: '/tr',
      icon: 'list-todo',
      colorClass: 'nav-icon-tr',
    },
    {
      name: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      path: '/wakti-ai',
      icon: 'sparkles',
      colorClass: 'nav-icon-ai',
    },
    {
      name: language === 'ar' ? 'تسجيل' : 'Tasjeel',
      path: '/tasjeel',
      icon: 'mic',
      colorClass: 'text-cyan-500', // Changed to cyan color
    }
  ];
  
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    calendar: Calendar,
    'calendar-clock': CalendarClock,
    'list-todo': ListTodo,
    sparkles: Sparkles,
    mic: Mic,
  };
  
  return (
    <nav className="fixed bottom-1 left-0 w-full z-50">
      <div className="bg-gradient-nav backdrop-blur-lg border-t border-border/50 shadow-vibrant">
        <ul className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const IconComponent = iconMap[item.icon] || Calendar;
            const isActive = pathname === item.path || (item.path === '/maw3d' && pathname.startsWith('/maw3d')) || (item.path === '/tr' && pathname.startsWith('/tr'));
            
            return (
              <li key={item.path} className="flex-1 flex justify-center">
                <button
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 p-2 rounded-xl w-full transition-all duration-300 relative group",
                    "hover:bg-gradient-card hover:shadow-glow hover:scale-105 active:scale-95",
                    isActive 
                      ? "bg-gradient-card shadow-colored scale-105" 
                      : "hover:bg-accent/10"
                  )}
                >
                  <div className={cn(
                    "relative transition-all duration-300",
                    isActive && "nav-icon-active"
                  )}>
                    <IconComponent 
                      className={cn(
                        "h-6 w-6 transition-all duration-300",
                        item.colorClass,
                        isActive 
                          ? "scale-110 brightness-125" 
                          : "group-hover:scale-110 group-hover:brightness-110"
                      )} 
                    />
                    {isActive && (
                      <div className="absolute inset-0 rounded-full animate-glow-pulse opacity-50" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-all duration-300",
                    item.path === '/tasjeel' ? "text-cyan-500" : "", // Added cyan color for Tasjeel text
                    isActive 
                      ? "text-foreground font-semibold" 
                      : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.name}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-vibrant rounded-full animate-shimmer" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
