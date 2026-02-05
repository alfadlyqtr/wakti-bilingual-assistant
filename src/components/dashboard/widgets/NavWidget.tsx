import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  CalendarClock, 
  Mic, 
  Sparkles, 
  ListTodo, 
  LayoutDashboard, 
  PenTool, 
  Gamepad2, 
  NotebookPen, 
  Music, 
  AudioLines, 
  FolderOpen, 
  Code2
} from "lucide-react";
import { WaktiIcon } from "@/components/icons/WaktiIcon";
import { t } from "@/utils/translations";
import { useWidgetDragHandle } from "@/components/dashboard/WidgetDragHandleContext";

interface NavWidgetProps {
  language?: "en" | "ar";
}

export function NavWidget({ language: propLanguage }: NavWidgetProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { language: themeLanguage, theme } = useTheme();
  const language = propLanguage || themeLanguage;
  const { registerHandle, listeners, attributes, isDragging } = useWidgetDragHandle();

  const navItems = [
    {
      name: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      colorClass: 'text-blue-500',
      glowColor: '#3b82f6',
    },
    {
      name: language === 'ar' ? 'التقويم' : 'Calendar',
      path: '/calendar',
      icon: Calendar,
      colorClass: 'text-sky-400',
      glowColor: '#38bdf8',
    },
    {
      name: language === 'ar' ? 'المذكرات' : 'Journal',
      path: '/journal',
      icon: NotebookPen,
      colorClass: 'text-pink-500',
      glowColor: '#ec4899',
    },
    {
      name: language === 'ar' ? 'مواعيد' : 'Maw3d',
      path: '/maw3d',
      icon: CalendarClock,
      colorClass: 'text-purple-500',
      glowColor: '#a855f7',
    },
    {
      name: language === 'ar' ? 'م & ت' : 'T & R',
      path: '/tr',
      icon: ListTodo,
      colorClass: 'text-green-500',
      glowColor: '#22c55e',
    },
    {
      name: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      path: '/wakti-ai',
      icon: Sparkles,
      colorClass: 'text-orange-500',
      glowColor: '#f97316',
    },
    {
      name: t('music', language),
      path: '/music',
      icon: Music,
      colorClass: 'text-fuchsia-500',
      glowColor: '#d946ef',
    },
    {
      name: language === 'ar' ? 'الحيوية' : 'Vitality',
      path: '/fitness',
      icon: WaktiIcon,
      colorClass: 'text-rose-500',
      glowColor: '#f43f5e',
    },
    {
      name: language === 'ar' ? 'تسجيل' : 'Tasjeel',
      path: '/tasjeel',
      icon: AudioLines,
      colorClass: 'text-cyan-500',
      glowColor: '#06b6d4',
    },
    {
      name: t('my_warranty', language),
      path: '/my-warranty',
      icon: FolderOpen,
      colorClass: 'text-emerald-500',
      glowColor: '#10b981',
    },
    {
      name: language === 'ar' ? 'مشاريع' : 'Projects',
      path: '/projects',
      icon: Code2,
      colorClass: 'text-indigo-500',
      glowColor: '#6366f1',
    },
    {
      name: language === 'ar' ? 'نص' : 'Text',
      path: '/tools/text',
      icon: PenTool,
      colorClass: 'text-violet-500',
      glowColor: '#8b5cf6',
    },
    {
      name: language === 'ar' ? 'صوت' : 'Voice',
      path: '/tools/voice-studio',
      icon: Mic,
      colorClass: 'text-pink-400',
      glowColor: '#f472b6',
    },
    {
      name: language === 'ar' ? 'لعبة' : 'Game',
      path: '/tools/game',
      icon: Gamepad2,
      colorClass: 'text-red-500',
      glowColor: '#ef4444',
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div
      className={cn(
        "p-4 rounded-3xl",
        theme === "dark"
          ? "bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_30%,hsl(250_20%_10%)_70%,#0c0f14_100%)]"
          : "bg-[linear-gradient(135deg,#fcfefd_0%,hsl(200_15%_96%)_35%,#fcfefd_100%)]",
        theme === "dark"
          ? "border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.50),0_4px_20px_rgba(59,130,246,0.18)]"
          : "border border-black/5 shadow-[0_10px_40px_rgba(6,5,65,0.12),0_4px_20px_rgba(6,5,65,0.08)]"
      )}
    >
      {/* Header with drag handle */}
      <div 
        ref={registerHandle}
        {...listeners}
        {...attributes}
        className={cn(
          "flex items-center gap-2 mb-4 cursor-grab active:cursor-grabbing",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "p-1.5 rounded-lg",
            theme === "dark"
              ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20"
              : "bg-gradient-to-br from-[#060541]/10 to-[#e9ceb0]/35 border border-black/5"
          )}
        >
          <Sparkles className={cn("h-4 w-4", theme === "dark" ? "text-orange-400" : "text-[#060541]/80")} />
        </div>
        <h3
          className={cn(
            "text-sm font-semibold tracking-tight",
            theme === "dark" ? "text-foreground/90" : "text-[#060541]/80"
          )}
        >
          {language === 'ar' ? 'الوصول السريع' : 'Quick Access'}
        </h3>
      </div>

      {/* Nav Grid - 5 columns, wraps to rows */}
      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = pathname === item.path || 
            (item.path === '/maw3d' && pathname.startsWith('/maw3d')) || 
            (item.path === '/tr' && pathname.startsWith('/tr')) ||
            (item.path === '/dashboard' && pathname === '/dashboard');

          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 p-2 md:p-3 rounded-2xl transition-all duration-200 ease-out group",
                theme === "dark"
                  ? "bg-white/5 hover:bg-white/10"
                  : "bg-white/80 hover:bg-white border border-black/5",
                theme === "dark" ? "border border-transparent hover:border-white/10" : "shadow-[0_8px_22px_rgba(6,5,65,0.08)]",
                "active:scale-95",
                isActive && (theme === "dark" ? "bg-gradient-to-br border-white/20 shadow-lg" : "bg-gradient-to-br shadow-lg")
              )}
              style={{
                ...(isActive && {
                  background: `linear-gradient(135deg, ${item.glowColor}15 0%, ${item.glowColor}08 100%)`,
                  boxShadow: `0 4px 20px ${item.glowColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
                  borderColor: `${item.glowColor}40`,
                })
              }}
            >
              {/* Idle glow (premium) */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-1 rounded-2xl blur-lg transition-opacity duration-200",
                  isActive
                    ? "opacity-10"
                    : theme === "dark"
                      ? "opacity-[0.035] group-hover:opacity-[0.06]"
                      : "opacity-[0.04] group-hover:opacity-[0.07]"
                )}
                style={{ backgroundColor: item.glowColor }}
              />

              {/* Icon container with glow */}
              <div className="relative">
                <IconComponent 
                  className={cn(
                    "h-5 w-5 md:h-6 md:w-6 transition-all duration-200",
                    item.colorClass,
                    isActive && "scale-110"
                  )}
                />
                {/* Glow effect for active */}
                {isActive && (
                  <div 
                    className="absolute inset-0 rounded-full blur-lg opacity-60 -z-10"
                    style={{ backgroundColor: item.glowColor }}
                  />
                )}
              </div>

              {/* Label - visible on mobile, smaller; larger on tablet/desktop */}
              <span className={cn(
                "text-[9px] sm:text-[10px] md:text-[11px] font-medium leading-tight text-center w-full line-clamp-2",
                theme === "dark"
                  ? (isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80")
                  : (isActive ? "text-[#060541]" : "text-[#060541]/70 group-hover:text-[#060541]/90")
              )}>
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
