import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar,
  CalendarClock,
  Mic,
  Sparkles,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Music
} from "lucide-react";
import { t } from "@/utils/translations";
import { Logo3D } from "@/components/Logo3D";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
}

export function TabletSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed on tablet
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { maw3dEventCount, contactCount } = useUnreadMessages();

  const navItems: NavItemProps[] = [
    { icon: Calendar, label: "calendar", path: "/calendar" },
    { icon: CalendarClock, label: "events", path: "/maw3d", badge: maw3dEventCount },
    { icon: ListTodo, label: "tasks", path: "/tr", badge: 0 },
    { icon: Sparkles, label: "wakti_ai", path: "/wakti-ai" },
    { icon: Music, label: "music", path: "/music" },
    { icon: Gamepad2, label: "games", path: "/games" },
    { icon: Mic, label: "tasjeel", path: "/tasjeel" },
  ];

  const bottomNavItems: NavItemProps[] = [];  // Remove settings and knowledge

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // Update CSS custom property for dynamic layout
    document.documentElement.style.setProperty(
      '--current-tablet-sidebar-width', 
      !isCollapsed ? 'var(--tablet-sidebar-mini-width)' : 'var(--tablet-sidebar-width)'
    );
  };

  const sidebarVariants = {
    expanded: { width: "180px" },
    collapsed: { width: "60px" },
  };

  // Set initial CSS variable
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      '--current-tablet-sidebar-width', 
      isCollapsed ? 'var(--tablet-sidebar-mini-width)' : 'var(--tablet-sidebar-width)'
    );
  }, [isCollapsed]);

  return (
    <motion.aside
      id="tablet-sidebar"
      className="fixed left-3 top-3 bottom-3 z-[999] rounded-xl shadow-xl transition-all duration-300"
      dir="ltr"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{
        left: '0.75rem',
        right: 'auto',
        top: '0.75rem',
        bottom: '0.75rem',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.1) 100%), var(--gradient-background)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: `
          0 20px 40px -12px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          0 6px 24px rgba(0, 0, 0, 0.12)
        `
      }}
    >
      {/* Glass reflection overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-30 pointer-events-none" />
      
      <div className="flex flex-col h-full p-3 relative z-10">
        {/* Toggle Button */}
        <div className="flex items-center justify-between mb-4">
          <AnimatePresence>
            {!isCollapsed && (
              <Link to="/dashboard" className="flex items-center hover:opacity-80 transition-opacity">
                <Logo3D size="sm" />
              </Link>
            )}
            {isCollapsed && (
              <Link to="/dashboard" className="flex items-center justify-center w-full hover:opacity-80 transition-opacity">
                <Logo3D size="sm" />
              </Link>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="rounded-lg h-7 w-7 hover:bg-white/10 dark:hover:bg-white/5"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path === '/maw3d' && location.pathname.startsWith('/maw3d')) || 
                (item.path === '/tr' && location.pathname.startsWith('/tr')) ||
                (item.path === '/games' && location.pathname.startsWith('/games'));
              
              // Define color classes matching mobile nav
              const getColorClass = (path: string) => {
                switch (path) {
                  case '/calendar': return 'nav-icon-calendar';
                  case '/maw3d': return 'nav-icon-maw3d';
                  case '/tr': return 'nav-icon-tr';
                  case '/wakti-ai': return 'nav-icon-ai';
                  case '/music': return 'text-fuchsia-500';
                  case '/games': return 'text-indigo-500';
                  case '/tasjeel': return 'text-cyan-500';
                  default: return '';
                }
              };
              
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'h-12 px-1' : 'h-10'} justify-start rounded-lg transition-all duration-300 group ${
                    isActive
                      ? "bg-white/10 dark:bg-white/5 shadow-md"
                      : "hover:bg-white/5 dark:hover:bg-white/[0.02] hover:scale-105 active:scale-95"
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <div className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center w-full gap-1`}>
                    <div className="relative flex items-center justify-center">
                      <item.icon className={`h-4 w-4 transition-all duration-300 ${getColorClass(item.path)} ${
                        isActive 
                          ? "scale-110 brightness-125" 
                          : "group-hover:scale-110 group-hover:brightness-110"
                      }`} />
                      {item.badge && item.badge > 0 && (
                        <div className="absolute -top-1 -right-1 min-w-3 h-3 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border border-background z-10">
                          {item.badge > 99 ? '99+' : item.badge}
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className={`text-xs font-medium transition-all duration-300 ${
                            item.path === '/tasjeel' ? "text-cyan-500" : ""
                          } ${
                            isActive 
                              ? "text-foreground font-semibold" 
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {t(item.label as any, language)}
                        </motion.span>
                      )}
                      {isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, y: 2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 2 }}
                          className={`text-xs font-medium transition-all duration-300 ${
                            item.path === '/tasjeel' ? "text-cyan-500" : ""
                          } ${
                            isActive 
                              ? "text-foreground font-semibold" 
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          {t(item.label as any, language)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </Button>
              );
            })}
          </nav>
        </div>
      </div>
    </motion.aside>
  );
}