import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
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
  Home
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

export function DesktopSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { user } = useAuth();
  const { maw3dEventCount, contactCount } = useUnreadMessages();

  const navItems: NavItemProps[] = [
    { icon: Calendar, label: "calendar", path: "/calendar" },
    { icon: CalendarClock, label: "events", path: "/maw3d", badge: maw3dEventCount },
    { icon: ListTodo, label: "tasks", path: "/tr", badge: 0 },
    { icon: Sparkles, label: "wakti_ai", path: "/wakti-ai" },
    { icon: Mic, label: "tasjeel", path: "/tasjeel" },
  ];

  const bottomNavItems: NavItemProps[] = [];  // Remove settings and knowledge

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const sidebarVariants = {
    expanded: { width: "var(--sidebar-width)" },
    collapsed: { width: "var(--sidebar-mini-width)" },
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen bg-background/95 dark:bg-[#0b0f14]/95 backdrop-blur-xl border-r border-border/60 dark:border-white/20 z-[999]"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 h-[var(--desktop-header-h)]">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center space-x-3"
              >
                <Link to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                  <Logo3D size="sm" />
                  <span className="font-bold text-lg">WAKTI</span>
                </Link>
              </motion.div>
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
            className="rounded-lg h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        <Separator />

        {/* Main Navigation */}
        <ScrollArea className="flex-1 px-3">
          <nav className="py-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path === '/maw3d' && location.pathname.startsWith('/maw3d')) || 
                (item.path === '/tr' && location.pathname.startsWith('/tr'));
              
              // Define color classes matching mobile nav
              const getColorClass = (path: string) => {
                switch (path) {
                  case '/calendar': return 'nav-icon-calendar';
                  case '/maw3d': return 'nav-icon-maw3d';
                  case '/tr': return 'nav-icon-tr';
                  case '/wakti-ai': return 'nav-icon-ai';
                  case '/tasjeel': return 'text-cyan-500';
                  default: return '';
                }
              };
              
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'h-16 px-2' : 'h-14'} justify-start rounded-xl transition-all duration-300 group ${
                    isActive
                      ? "bg-gradient-card shadow-colored scale-105"
                      : "hover:bg-gradient-card hover:shadow-glow hover:scale-105 active:scale-95"
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <div className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center w-full gap-2`}>
                    <div className="relative flex items-center justify-center">
                      <item.icon className={`h-6 w-6 transition-all duration-300 ${getColorClass(item.path)} ${
                        isActive 
                          ? "scale-110 brightness-125 nav-icon-active" 
                          : "group-hover:scale-110 group-hover:brightness-110"
                      }`} />
                      {item.badge && item.badge > 0 && (
                        <div className="absolute -top-2 -right-2 min-w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border-2 border-background z-10 animate-pulse">
                          {item.badge > 99 ? '99+' : item.badge}
                        </div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 rounded-full animate-glow-pulse opacity-50" />
                      )}
                    </div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className={`text-sm font-medium transition-all duration-300 ${
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
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
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
                    {isActive && !isCollapsed && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-vibrant rounded-full animate-shimmer" />
                    )}
                  </div>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>
      </div>
    </motion.aside>
  );
}