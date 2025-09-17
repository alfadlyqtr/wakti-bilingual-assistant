import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles, ListTodo, LayoutDashboard } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { waktiBadges } from "@/services/waktiBadges";

interface MobileSlideDownNavProps {
  isOpen: boolean;
  onClose: () => void;
  logoPosition: { x: number; y: number; width: number; height: number } | null;
}

export function MobileSlideDownNav({ isOpen, onClose, logoPosition }: MobileSlideDownNavProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { taskCount, maw3dEventCount, contactCount, sharedTaskCount } = useUnreadMessages();
  const [badgeStates, setBadgeStates] = useState<Record<string, any>>({});
  const [animationStage, setAnimationStage] = useState<'closed' | 'sliding' | 'icons'>('closed');

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

  // Animation sequence
  useEffect(() => {
    if (isOpen) {
      setAnimationStage('sliding');
      const timer = setTimeout(() => {
        setAnimationStage('icons');
      }, 300); // Wait for slide animation to complete
      return () => clearTimeout(timer);
    } else {
      setAnimationStage('closed');
    }
  }, [isOpen]);

  // Navigation items with Dashboard added
  const navItems = [
    {
      name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
      path: '/dashboard',
      icon: 'dashboard',
      colorClass: 'text-blue-500',
    },
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
    dashboard: LayoutDashboard,
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
    onClose();
  };

  if (!isOpen || !logoPosition) return null;

  return (
    <>
      {/* Backdrop blur - exclude header area */}
      <div 
        className={cn(
          "fixed z-40 transition-all duration-300",
          isOpen ? "backdrop-blur-md bg-black/20" : "backdrop-blur-none bg-transparent pointer-events-none"
        )}
        style={{
          top: 'var(--app-header-h)',
          left: 0,
          right: 0,
          bottom: 0
        }}
        onClick={onClose}
      />
      
      {/* Slide down container */}
      <div
        className={cn(
          "fixed z-50 bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl transition-all duration-300 ease-out",
          animationStage === 'closed' && "opacity-0 scale-95 -translate-y-4",
          animationStage === 'sliding' && "opacity-100 scale-100 translate-y-0",
          animationStage === 'icons' && "opacity-100 scale-100 translate-y-0"
        )}
        style={{
          left: logoPosition.x,
          top: logoPosition.y + logoPosition.height + 8,
          width: logoPosition.width * 4, // Reduced from 6 to 4 for narrower width
          transformOrigin: 'top left'
        }}
      >
        <div className="p-4">
          <div className="flex flex-col space-y-3">
            {navItems.map((item, index) => {
              const IconComponent = iconMap[item.icon] || Calendar;
              const isActive = pathname === item.path || 
                (item.path === '/maw3d' && pathname.startsWith('/maw3d')) || 
                (item.path === '/tr' && pathname.startsWith('/tr'));
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path, item.badgeType)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 relative group w-full text-left",
                    "hover:bg-accent/10 active:opacity-90",
                    isActive ? "bg-gradient-card shadow-colored" : "",
                    // Pop-up animation with staggered delay
                    animationStage === 'icons' 
                      ? "opacity-100 translate-y-0" 
                      : "opacity-0 translate-y-4",
                    "transition-all duration-300 ease-out"
                  )}
                  style={{
                    transitionDelay: animationStage === 'icons' ? `${index * 100}ms` : '0ms'
                  }}
                >
                  <div className="relative">
                    <IconComponent 
                      className={cn(
                        "h-5 w-5",
                        item.colorClass,
                        isActive ? "scale-110 brightness-125" : ""
                      )} 
                    />
                    {/* Badge System */}
                    {item.badgeType && badgeStates[item.badgeType]?.show && (
                      <div className={cn(
                        "absolute -top-2 -right-2 min-w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border border-background z-10",
                        badgeStates[item.badgeType].priority === 'high' && "animate-pulse bg-orange-500"
                      )}>
                        {badgeStates[item.badgeType].count}
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    item.path === '/tasjeel' ? "text-cyan-500" : "",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
