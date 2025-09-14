import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // Update CSS custom property for dynamic layout
    document.documentElement.style.setProperty(
      '--current-sidebar-width', 
      !isCollapsed ? 'var(--sidebar-mini-width)' : 'var(--sidebar-width)'
    );
  };

  // Smoother opening/closing with material-like ease
  const sidebarVariants = {
    expanded: {
      width: 240,
      x: 0,
      opacity: 1,
      transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
    },
    collapsed: {
      width: 70,
      x: 0,
      opacity: 1,
      transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
    },
  };

  // Stagger nav item entrance for premium feel
  const navVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        when: 'beforeChildren',
        staggerChildren: 0.03,
      }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, x: -6 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 480, damping: 34 } }
  } as const;

  // Set initial CSS variable
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      '--current-sidebar-width', 
      isCollapsed ? 'var(--sidebar-mini-width)' : 'var(--sidebar-width)'
    );
  }, [isCollapsed]);

  return (
    <>
      {/* Desktop/Tablet mask to hide underlying content under the curved sidebar edge */}
      <div
        id="desktop-sidebar-mask"
        className="hidden md:block fixed inset-y-0 left-0 z-[998] bg-background pointer-events-none"
        style={{ width: 'calc(var(--current-sidebar-width, 240px) + 1.75rem)', left: 0, right: 'auto' }}
        aria-hidden
      />
      <motion.aside
      id="desktop-sidebar"
      className="fixed left-4 top-4 bottom-4 z-[999] rounded-2xl shadow-2xl"
      dir="ltr"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      style={{
        left: '1rem',
        right: 'auto',
        top: '1rem',
        bottom: '1rem',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.1) 100%), var(--gradient-background)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: `
          0 25px 50px -12px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(255, 255, 255, 0.05),
          inset 0 1px 0 rgba(255, 255, 255, 0.1),
          0 8px 32px rgba(0, 0, 0, 0.12)
        `
      }}
    >
      {/* Glass reflection overlay */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none"
        initial={{ opacity: 0.15 }}
        animate={{ opacity: isCollapsed ? 0.15 : 0.3 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      />
      
      <div className="flex flex-col h-full p-4 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
            className="rounded-xl h-8 w-8 hover:bg-white/10 dark:hover:bg-white/5"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {/* Main Navigation */}
        <div className="flex-1">
          <motion.nav className="space-y-2" variants={navVariants} initial="hidden" animate="show">
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
                <motion.button
                  key={item.label}
                  className={`w-full ${isCollapsed ? 'h-14 px-2' : 'h-12'} justify-start rounded-xl group ${
                    isActive
                      ? "bg-white/10 dark:bg-white/5 shadow-lg backdrop-blur-sm"
                      : "hover:bg-white/5 dark:hover:bg-white/[0.02]"
                  } transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:scale-[1.02] active:scale-[0.98]`}
                  onClick={() => handleNavigation(item.path)}
                  variants={itemVariants}
                >
                  <div className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center w-full gap-2`}>
                    <div className="relative flex items-center justify-center">
                      <item.icon className={`h-5 w-5 transition-all duration-300 ${getColorClass(item.path)} ${
                        isActive 
                          ? "scale-110 brightness-125" 
                          : "group-hover:scale-110 group-hover:brightness-110"
                      }`} />
                      {item.badge && item.badge > 0 && (
                        <div className="absolute -top-1 -right-1 min-w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 border border-background z-10">
                          {item.badge > 99 ? '99+' : item.badge}
                        </div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
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
                  </div>
                </motion.button>
              );
            })}
          </motion.nav>
        </div>
      </div>
    </motion.aside>
    </>
  );
}