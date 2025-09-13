import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles, ListTodo } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { waktiBadges } from "@/services/waktiBadges";

export function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { taskCount, maw3dEventCount, contactCount, sharedTaskCount } = useUnreadMessages();
  const [badgeStates, setBadgeStates] = useState<Record<string, any>>({});

  // No portal: ensure direct render inside AppLayout for guaranteed presence

  // Clear badges when navigating to specific pages
  useEffect(() => {
    if (pathname.startsWith('/tr')) {
      waktiBadges.clearBadge('task');
    } else if (pathname.startsWith('/maw3d')) {
      waktiBadges.clearBadge('event');
    } else if (pathname.startsWith('/contacts')) {
      waktiBadges.clearBadge('contact');
    }
  }, [pathname]);

  useEffect(() => {
    // Only show badges when there's actual data > 0
    setBadgeStates({
      task: { 
        show: taskCount > 0 || sharedTaskCount > 0, 
        count: (taskCount + sharedTaskCount) > 99 ? '99+' : (taskCount + sharedTaskCount).toString(),
        priority: (taskCount + sharedTaskCount) > 5 ? 'high' : 'normal'
      },
      event: { 
        show: maw3dEventCount > 0, 
        count: maw3dEventCount > 99 ? '99+' : maw3dEventCount.toString(),
        priority: maw3dEventCount > 3 ? 'high' : 'normal'
      }, 
      contact: { 
        show: contactCount > 0, 
        count: contactCount > 99 ? '99+' : contactCount.toString(),
        priority: contactCount > 0 ? 'normal' : 'low'
      }
    });
  }, [taskCount, maw3dEventCount, contactCount, sharedTaskCount]);
  
  // Navigation items
  const navItems = [
    {
      name: language === 'ar' ? 'التقويم' : 'Calendar',
      path: '/calendar',
      icon: 'calendar',
      colorClass: 'nav-icon-calendar',
      badgeType: 'event',
    },
    {
      name: language === 'ar' ? 'مواعيد' : 'Maw3d', 
      path: '/maw3d',
      icon: 'calendar-clock',
      colorClass: 'nav-icon-maw3d',
      badgeType: 'event',
    },
    {
      name: language === 'ar' ? 'م & ت' : 'T & R',
      path: '/tr',
      icon: 'list-todo', 
      colorClass: 'nav-icon-tr',
      badgeType: 'task',
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
      colorClass: 'text-cyan-500',
    }
  ];
  
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    calendar: Calendar,
    'calendar-clock': CalendarClock,
    'list-todo': ListTodo,
    sparkles: Sparkles,
    mic: Mic,
  };

  const handleNavigation = (path: string, badgeType?: string) => {
    // Clear relevant badge when navigating
    if (badgeType) {
      waktiBadges.clearBadge(badgeType);
    }
    navigate(path);
  };
  
  return (
    <nav
      id="mobile-nav"
      data-test="mobile-nav"
      aria-label="Mobile Navigation"
      className={`fixed bottom-0 left-0 right-0 glue-fixed glue-bottom glue-z`}
      style={{ zIndex: 2147483647, pointerEvents: 'auto', minHeight: '68px', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="bg-white/80 dark:bg-neutral-900/70 backdrop-blur-2xl ios-reduce-blur border-t border-white/20 dark:border-white/10 shadow-vibrant pb-[calc(env(safe-area-inset-bottom)+4px)]">
        <ul className="flex justify-around items-center h-[68px] min-h-[68px] px-2">
          {navItems.map((item) => {
            const IconComponent = iconMap[item.icon] || Calendar;
            const isActive = pathname === item.path || (item.path === '/maw3d' && pathname.startsWith('/maw3d')) || (item.path === '/tr' && pathname.startsWith('/tr'));
            
            return (
              <li key={item.path} className="flex-1 flex justify-center">
                <button
                  onClick={() => handleNavigation(item.path, item.badgeType)}
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
                    {/* Real Badge System - Only show when data exists */}
                    {item.badgeType && badgeStates[item.badgeType]?.show && (
                      <div className={cn(
                        "absolute -top-2 -right-2 min-w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border-2 border-background z-10",
                        badgeStates[item.badgeType].priority === 'high' && "animate-pulse bg-orange-500"
                      )}>
                        {badgeStates[item.badgeType].count}
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full animate-glow-pulse opacity-50" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-all duration-300",
                    item.path === '/tasjeel' ? "text-cyan-500" : "",
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
