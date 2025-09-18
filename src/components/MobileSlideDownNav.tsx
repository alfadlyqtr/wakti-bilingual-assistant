import React, { useEffect, useState } from "react";
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles, ListTodo, LayoutDashboard, PenTool, Gamepad2 } from "lucide-react";
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

  // Quick action items (tools)
  const quickItems = [
    {
      name: language === 'ar' ? 'مولد النصوص' : 'Text Generator',
      path: '/tools/text',
      icon: 'pen',
      colorClass: 'text-purple-500',
    },
    {
      name: language === 'ar' ? 'استوديو الصوت' : 'Voice Studio',
      path: '/tools/voice-studio',
      icon: 'mic',
      colorClass: 'text-pink-500',
    },
    {
      name: language === 'ar' ? 'وضع الألعاب' : 'Game Mode',
      path: '/tools/game',
      icon: 'gamepad',
      colorClass: 'text-red-500',
    },
  ];
  
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    dashboard: LayoutDashboard,
    calendar: Calendar,
    'calendar-clock': CalendarClock,
    'list-todo': ListTodo,
    sparkles: Sparkles,
    mic: Mic,
    pen: PenTool,
    gamepad: Gamepad2,
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

  return createPortal(
    <>
      {/* Backdrop blur - ONLY page content, NOT header */}
      <div 
        className={cn(
          "fixed transition-all duration-300",
          isOpen ? "backdrop-blur-md bg-black/50" : "backdrop-blur-none bg-transparent pointer-events-none"
        )}
        style={{
          top: 'var(--app-header-h)',
          left: 0,
          right: 0,
          // Do NOT depend on chat variables; use tabs height + safe area only
          bottom: 'max(var(--app-bottom-tabs-h, 64px), env(safe-area-inset-bottom, 0px))',
          // Sit just below the header (header uses 2147480000 via .glue-z)
          zIndex: 2147470000,
          // Force blur across browsers
          backdropFilter: isOpen ? 'blur(12px) saturate(120%)' : 'none',
          WebkitBackdropFilter: isOpen ? 'blur(12px) saturate(120%)' : 'none'
        }}
        onClick={onClose}
      />
      
      {/* Slide down container */}
      <div
        className={cn(
          "fixed bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl transition-all duration-300 ease-out",
          animationStage === 'closed' && "opacity-0 scale-95 -translate-y-4",
          animationStage === 'sliding' && "opacity-100 scale-100 translate-y-0",
          animationStage === 'icons' && "opacity-100 scale-100 translate-y-0"
        )}
        style={{
          left: logoPosition.x,
          top: logoPosition.y + logoPosition.height + 8,
          width: logoPosition.width * 4, // Reduced from 6 to 4 for narrower width
          transformOrigin: 'top left',
          // Sit above the overlay but below/next to the header
          zIndex: 2147483647
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
                    isActive 
                      ? "bg-gradient-to-r shadow-2xl" 
                      : "",
                    // Add specific glow colors for active buttons
                    isActive && item.path === '/dashboard' && "from-blue-500/20 to-blue-600/20 shadow-blue-500/50 border border-blue-500/30",
                    isActive && item.path === '/calendar' && "from-blue-400/20 to-blue-500/20 shadow-blue-400/50 border border-blue-400/30",
                    isActive && item.path === '/maw3d' && "from-purple-500/20 to-purple-600/20 shadow-purple-500/50 border border-purple-500/30",
                    isActive && item.path === '/tr' && "from-green-500/20 to-green-600/20 shadow-green-500/50 border border-green-500/30",
                    isActive && item.path === '/wakti-ai' && "from-orange-500/20 to-orange-600/20 shadow-orange-500/50 border border-orange-500/30",
                    isActive && item.path === '/tasjeel' && "from-cyan-500/20 to-cyan-600/20 shadow-cyan-500/50 border border-cyan-500/30"
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
                    {/* Glow effect for active item with matching colors */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full animate-pulse"
                        style={{
                          filter: 'blur(8px)',
                          opacity: 0.7,
                          zIndex: -1,
                          backgroundColor: 
                            item.path === '/dashboard' ? '#3b82f6' :
                            item.path === '/calendar' ? 'hsl(var(--accent-blue))' :
                            item.path === '/maw3d' ? 'hsl(var(--accent-purple))' :
                            item.path === '/tr' ? 'hsl(var(--accent-green))' :
                            item.path === '/wakti-ai' ? 'hsl(var(--accent-orange))' :
                            item.path === '/tasjeel' ? '#06b6d4' : '#3b82f6',
                          boxShadow: `0 0 20px ${
                            item.path === '/dashboard' ? '#3b82f6' :
                            item.path === '/calendar' ? 'hsl(var(--accent-blue))' :
                            item.path === '/maw3d' ? 'hsl(var(--accent-purple))' :
                            item.path === '/tr' ? 'hsl(var(--accent-green))' :
                            item.path === '/wakti-ai' ? 'hsl(var(--accent-orange))' :
                            item.path === '/tasjeel' ? '#06b6d4' : '#3b82f6'
                          }`
                        }}
                      />
                    )}
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
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground",
                    // Add glow to active text
                    isActive && "drop-shadow-[0_0_8px_currentColor]"
                  )}>
                    {item.name}
                  </span>
                </button>
              );
            })}

            {/* Quick actions (tools) */}
            {quickItems.map((item, qIndex) => {
              const IconComponent = iconMap[item.icon] || PenTool;
              const isActive = pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 relative group w-full text-left",
                    "hover:bg-accent/10 active:opacity-90",
                    isActive ? "bg-gradient-to-r shadow-2xl" : "",
                    isActive && item.path === '/tools/text' && "from-purple-500/15 to-purple-600/15 shadow-purple-500/40 border border-purple-500/20",
                    isActive && item.path === '/tools/voice-studio' && "from-pink-500/15 to-pink-600/15 shadow-pink-500/40 border border-pink-500/20",
                    isActive && item.path === '/tools/game' && "from-red-500/15 to-red-600/15 shadow-red-500/40 border border-red-500/20"
                  )}
                  style={{ transitionDelay: animationStage === 'icons' ? `${(navItems.length + qIndex) * 100}ms` : '0ms' }}
                >
                  <div className="relative">
                    <IconComponent 
                      className={cn(
                        "h-5 w-5",
                        item.colorClass,
                        isActive ? "scale-110 brightness-125" : ""
                      )}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
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
    </>,
    document.body
  );
}
