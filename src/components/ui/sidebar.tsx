
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
  Plus,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  Bell,
  FileText,
  LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
}

const navItems: NavItemProps[] = [
  { icon: LayoutDashboard, label: "dashboard", path: "/" },
  { icon: ListChecks, label: "tasks", path: "/tasks" },
  { icon: CheckCircle2, label: "reminders", path: "/reminders" },
  { icon: Calendar, label: "events", path: "/events" },
  { icon: MessageSquare, label: "messages", path: "/messages" },
  { icon: Users, label: "contacts", path: "/contacts" },
  { icon: FileText, label: "voiceSummary", path: "/voice-summary" },
  // { icon: Settings, label: "settings", path: "/settings" },
];

const bottomNavItems: NavItemProps[] = [
  { icon: Settings, label: "settings", path: "/settings" },
  { icon: HelpCircle, label: "knowledge", path: "/knowledge" },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { user } = useAuth();
  const { isMobile } = useIsMobile();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const getInitials = () => {
    if (!user) return "?";

    const name = user.user_metadata?.full_name || user.email || "";
    if (!name) return "?";

    if (name.includes(" ")) {
      const [first, last] = name.split(" ");
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }

    return name.charAt(0).toUpperCase();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const sidebarVariants = {
    open: { width: 250 },
    collapsed: { width: 65 },
  };

  // Fix the variants type for framer-motion
  const containerVariants = {
    open: { x: 0, opacity: 1, transition: { type: "spring" } },
    closed: { x: "-100%", opacity: 0, transition: { type: "spring" } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="flex flex-col h-screen bg-secondary border-r border-muted"
            initial="closed"
            animate="open"
            exit="closed"
            variants={containerVariants}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="flex items-center justify-between p-4"
              style={{ width: isCollapsed ? 65 : 250 }}
            >
              <Link to="/" className="flex items-center space-x-2">
                <Home className="h-6 w-6 text-primary" />
                {!isCollapsed && (
                  <motion.span className="font-bold text-lg">
                    Dashboard
                  </motion.span>
                )}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="rounded-full"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </motion.div>

            <ScrollArea className="flex-1 px-3">
              <Separator />
              <motion.nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => (
                  <motion.div
                    key={item.label}
                    variants={sidebarVariants}
                    initial={isCollapsed ? "collapsed" : "open"}
                    animate={isCollapsed ? "collapsed" : "open"}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full h-9 justify-start px-2 rounded-md ${
                        location.pathname === item.path
                          ? "bg-muted/50 dark:bg-muted/80"
                          : "hover:bg-muted/20"
                      }`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!isCollapsed && <span>{t(item.label as any, language)}</span>}
                    </Button>
                  </motion.div>
                ))}
              </motion.nav>
              <Separator />
            </ScrollArea>

            <motion.div
              className="py-4 px-3"
              style={{ width: isCollapsed ? 65 : 250 }}
            >
              <Separator />
              <motion.nav className="py-4 space-y-1">
                {bottomNavItems.map((item) => (
                  <motion.div
                    key={item.label}
                    variants={sidebarVariants}
                    initial={isCollapsed ? "collapsed" : "open"}
                    animate={isCollapsed ? "collapsed" : "open"}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full h-9 justify-start px-2 rounded-md ${
                        location.pathname === item.path
                          ? "bg-muted/50 dark:bg-muted/80"
                          : "hover:bg-muted/20"
                      }`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!isCollapsed && <span>{t(item.label as any, language)}</span>}
                    </Button>
                  </motion.div>
                ))}
              </motion.nav>
              <Separator />
            </motion.div>

            <motion.div
              className="p-4"
              style={{ width: isCollapsed ? 65 : 250 }}
            >
              <Separator />
              <motion.div
                className="flex items-center space-x-2 mt-4"
                variants={sidebarVariants}
                initial={isCollapsed ? "collapsed" : "open"}
                animate={isCollapsed ? "collapsed" : "open"}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <motion.span className="text-sm font-medium truncate">
                    {displayName}
                  </motion.span>
                )}
              </motion.div>
            </motion.div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
