import React, { useEffect, useState } from "react";
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { Calendar, CalendarClock, Mic, Sparkles, ListTodo, LayoutDashboard, PenTool, Gamepad2, HeartPulse } from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { waktiBadges } from "@/services/waktiBadges";
import { motion } from "framer-motion";

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
        priority: contactCount > 0 ? 'normal' : 'low'
      }
    });
  }, [taskCount, maw3dEventCount, contactCount, sharedTaskCount]);

  // Animation sequence for slide and menu items
  useEffect(() => {
    if (isOpen) {
      setAnimationStage('sliding');
      // After slide animation, show icons
      const iconTimer = setTimeout(() => setAnimationStage('icons'), 380);
      return () => clearTimeout(iconTimer);
    } else {
      setAnimationStage('closed');
    }
  }, [isOpen]);
  
  // Don't render anything if nav is closed
  if (!isOpen && animationStage === 'closed') return null;

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
      name: language === 'ar' ? 'الصحة واللياقة' : 'Fitness & Health',
      path: '/fitness',
      icon: 'heart-pulse',
      colorClass: 'text-rose-500',
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
      name: language === 'ar' ? 'الصوت والمترجم' : 'Voice & Translator',
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
    'heart-pulse': HeartPulse,
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
      {/* Backdrop blur - cover full page content (beneath header) down to absolute bottom */}
      <div 
        className={cn(
          "fixed transition-all duration-300",
          isOpen ? "backdrop-blur-xl bg-black/50" : "backdrop-blur-none bg-transparent pointer-events-none"
        )}
        style={{
          top: 'var(--app-header-h)',
          left: 0,
          right: 0,
          // Reach the visual bottom including under tabs for full-page blur
          bottom: 0,
          // Sit just below the header (header uses 2147480000 via .glue-z)
          zIndex: 2147470000,
          // Force blur across browsers
          backdropFilter: isOpen ? 'blur(16px) saturate(120%)' : 'none',
          WebkitBackdropFilter: isOpen ? 'blur(16px) saturate(120%)' : 'none'
        }}
        onClick={onClose}
      />
      
      {/* Slide down container (Liquid Glass + Glow) with 3D pop-out */}
      {/* Perspective wrapper to create real depth; positioned at the logo anchor */}
      <div
        className="fixed"
        style={{
          left: logoPosition.x,
          top: logoPosition.y + logoPosition.height + 8, // a hair below header
          zIndex: 2147483647,
          // Apply perspective on a non-transforming parent
          perspective: 1000,
          WebkitPerspective: 1000,
          transformOrigin: 'top left',
        }}
      >
        <motion.div
          className={cn(
            // Base glass card
            "rounded-xl overflow-visible",
            // Liquid glass surface: layered translucent gradients + blur + soft border
            "backdrop-blur-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.20),rgba(255,255,255,0.08))] bg-white/85 dark:bg-neutral-900/75",
            "border border-white/30 dark:border-white/10 ring-1 ring-white/20 backdrop-brightness-110 dark:backdrop-brightness-90",
            // Soft outer glow
            "shadow-[0_14px_34px_rgba(0,0,0,0.28),0_16px_60px_rgba(255,153,0,0.10)]"
          )}
          style={{ transformOrigin: 'top left' }}
          initial={{
            opacity: 0,
            scale: 1, // start at same logo visual scale
            y: -8,
            rotateX: 8,
            width: logoPosition.width,
            height: logoPosition.width, // start perfectly square like the logo
          }}
          animate={{
            // Sequence: emerge (opacity), expand (scale bump), then slide down to settle
            opacity: [0, 0.85, 1],
            width: [logoPosition.width, logoPosition.width * 4],
            height: 'auto',
            scale: [1, 1.02, 1.0],
            y: [-8, -2, 8],
            rotateX: [8, 2, 0],
          }}
          exit={{ opacity: 0, scale: 0.94, y: -6, rotateX: 4 }}
          transition={{
            duration: 0.5,
            ease: 'easeOut',
            times: [0, 0.6, 1],
          }}
        >
        {/* Bottom halo shadow to create a floating 3D effect */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-6 -bottom-6 h-12 rounded-[28px] bg-black/40 blur-2xl opacity-50"
          style={{ zIndex: -1 }}
        />
        {/* Subtle bevel for 3D edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.22)' }}
        />
        {/* Subtle inner highlight & vignette for glass depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              'radial-gradient(120% 80% at 0% -10%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.02) 70%, rgba(255,255,255,0) 100%),\
               radial-gradient(140% 90% at 100% 0%, rgba(255,170,85,0.18) 0%, rgba(255,170,85,0.06) 40%, rgba(255,170,85,0.00) 70%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)'
          }}
        />
        <div className="p-4 text-foreground">
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
                    // Staggered slide-down + pop-in per item
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ease-out relative group w-full text-left text-foreground",
                    // Base readable background and hover for contrast on glass
                    "bg-white/5 dark:bg-black/10 hover:bg-white/10 dark:hover:bg-white/5 active:opacity-95",
                    isActive 
                      ? "bg-gradient-to-r shadow-2xl" 
                      : "",
                    // Add specific glow colors for active buttons
                    isActive && item.path === '/dashboard' && "from-blue-500/20 to-blue-600/20 shadow-blue-500/50 border border-blue-500/30",
                    isActive && item.path === '/calendar' && "from-blue-400/20 to-blue-500/20 shadow-blue-400/50 border border-blue-400/30",
                    isActive && item.path === '/maw3d' && "from-purple-500/20 to-purple-600/20 shadow-purple-500/50 border border-purple-500/30",
                    isActive && item.path === '/tr' && "from-green-500/20 to-green-600/20 shadow-green-500/50 border border-green-500/30",
                    isActive && item.path === '/wakti-ai' && "from-orange-500/20 to-orange-600/20 shadow-orange-500/50 border border-orange-500/30",
                    isActive && item.path === '/tasjeel' && "from-cyan-500/20 to-cyan-600/20 shadow-cyan-500/50 border border-cyan-500/30",
                    // Initial off-screen state until icons stage
                    animationStage === 'icons' ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.98]"
                  )}
                  style={{
                    transitionDelay: animationStage === 'icons' ? `${index * 90}ms` : '0ms'
                  }}
                >
                  <div className="relative">
                    <IconComponent 
                      className={cn(
                        "h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
                        item.colorClass,
                        isActive ? "scale-110 brightness-125" : ""
                      )} 
                    />
                    {/* Glow effect for active item with matching colors */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full animate-pulse"
                        style={{
                          filter: 'blur(14px)',
                          opacity: 0.9,
                          zIndex: -1,
                          backgroundColor: 
                            item.path === '/dashboard' ? '#3b82f6' :
                            item.path === '/calendar' ? 'hsl(var(--accent-blue))' :
                            item.path === '/maw3d' ? 'hsl(var(--accent-purple))' :
                            item.path === '/tr' ? 'hsl(var(--accent-green))' :
                            item.path === '/wakti-ai' ? 'hsl(var(--accent-orange))' :
                            item.path === '/tasjeel' ? '#06b6d4' : '#3b82f6',
                          boxShadow: `0 0 28px ${
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
                    "text-sm font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
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
                    "flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ease-out relative group w-full text-left",
                    "bg-white/5 dark:bg-black/10 hover:bg-white/10 dark:hover:bg-white/5 active:opacity-95",
                    isActive ? "bg-gradient-to-r shadow-2xl" : "",
                    isActive && item.path === '/tools/text' && "from-purple-500/15 to-purple-600/15 shadow-purple-500/40 border border-purple-500/20",
                    isActive && item.path === '/tools/voice-studio' && "from-pink-500/15 to-pink-600/15 shadow-pink-500/40 border border-pink-500/20",
                    isActive && item.path === '/tools/game' && "from-red-500/15 to-red-600/15 shadow-red-500/40 border border-red-500/20",
                    animationStage === 'icons' ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.98]"
                  )}
                  style={{ transitionDelay: animationStage === 'icons' ? `${(navItems.length + qIndex) * 90}ms` : '0ms' }}
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
                    "text-sm font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
}
