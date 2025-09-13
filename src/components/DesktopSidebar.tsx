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
                <Logo3D size="sm" />
                <span className="font-bold text-lg">WAKTI</span>
              </motion.div>
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
          <nav className="py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'h-12 px-0' : 'h-10'} justify-start rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <div className="flex items-center w-full">
                    <div className="relative flex items-center">
                      <item.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
                      {item.badge && item.badge > 0 && (
                        <UnreadBadge 
                          count={item.badge} 
                          size="sm" 
                          className={isCollapsed ? "-right-1 -top-1" : "-right-2 -top-1"}
                        />
                      )}
                    </div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="truncate"
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
        </ScrollArea>
      </div>
    </motion.aside>
  );
}