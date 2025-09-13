import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard,
  ListChecks,
  Calendar,
  MessageSquare,
  Users,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  CheckCircle2,
  Clock,
  CalendarClock,
  Mic,
  Sparkles,
  ListTodo
} from "lucide-react";
import { t } from "@/utils/translations";
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
    { icon: LayoutDashboard, label: "dashboard", path: "/" },
    { icon: ListTodo, label: "tasks", path: "/tr", badge: 0 },
    { icon: CheckCircle2, label: "reminders", path: "/reminders" },
    { icon: CalendarClock, label: "events", path: "/maw3d", badge: maw3dEventCount },
    { icon: Calendar, label: "calendar", path: "/calendar" },
    { icon: Sparkles, label: "wakti_ai", path: "/wakti-ai" },
    { icon: Mic, label: "tasjeel", path: "/tasjeel" },
    { icon: MessageSquare, label: "messages", path: "/messages", badge: contactCount },
    { icon: Users, label: "contacts", path: "/contacts" },
  ];

  const bottomNavItems: NavItemProps[] = [
    { icon: Settings, label: "settings", path: "/settings" },
    { icon: HelpCircle, label: "knowledge", path: "/knowledge" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const sidebarVariants = {
    expanded: { width: "var(--tablet-sidebar-width)" },
    collapsed: { width: "var(--tablet-sidebar-mini-width)" },
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen bg-background/95 dark:bg-[#0b0f14]/95 backdrop-blur-xl border-r border-border/60 dark:border-white/20 z-[999]"
      variants={sidebarVariants}
      animate={isCollapsed ? "collapsed" : "expanded"}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <div className="flex items-center justify-center p-2 h-[var(--tablet-header-h)]">
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
        <ScrollArea className="flex-1 px-2">
          <nav className="py-2 space-y-1">
            {navItems.slice(0, 6).map((item) => { // Show only first 6 items
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'h-10 px-0' : 'h-9'} justify-start rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <div className="flex items-center w-full">
                    <div className="relative flex items-center">
                      <item.icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-2'}`} />
                      {item.badge && item.badge > 0 && (
                        <UnreadBadge 
                          count={item.badge} 
                          size="sm" 
                          className={isCollapsed ? "-right-1 -top-1" : "-right-1 -top-1"}
                        />
                      )}
                    </div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="truncate text-sm"
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

        <Separator />

        {/* Bottom Navigation */}
        <div className="p-2">
          <nav className="space-y-1">
            {bottomNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'h-10 px-0' : 'h-9'} justify-start rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <div className="flex items-center w-full">
                    <item.icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-2'}`} />
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="truncate text-sm"
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