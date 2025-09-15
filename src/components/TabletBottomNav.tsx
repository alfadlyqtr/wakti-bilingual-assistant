import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare,
  Users,
  Sparkles,
  ListTodo
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: number;
  colorClass?: string;
}

export function TabletBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { maw3dEventCount, contactCount } = useUnreadMessages();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // On mobile, when keyboard appears, viewport height decreases significantly
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const screenHeight = window.screen.height;
      const keyboardThreshold = screenHeight * 0.75; // If viewport < 75% of screen, keyboard is likely visible
      
      setIsKeyboardVisible(viewportHeight < keyboardThreshold);
    };

    // Listen for visual viewport changes (more reliable for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      // Fallback for browsers without visual viewport support
      window.addEventListener('resize', handleResize);
    }

    // Initial check
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const navItems: NavItemProps[] = [
    { 
      icon: ListTodo, 
      label: "tasks", 
      path: "/tr", 
      badge: 0,
      colorClass: 'nav-icon-tr'
    },
    { 
      icon: MessageSquare, 
      label: "messages", 
      path: "/messages", 
      badge: contactCount,
      colorClass: 'nav-icon-maw3d'
    },
    { 
      icon: Sparkles, 
      label: "wakti_ai", 
      path: "/wakti-ai",
      colorClass: 'nav-icon-ai'
    },
    { 
      icon: Users, 
      label: "contacts", 
      path: "/contacts",
      colorClass: 'nav-icon-calendar'
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className={`fixed bottom-0 right-0 z-[1000] bg-white/90 dark:bg-[#0b0f14]/95 backdrop-blur-xl border-t border-border/60 dark:border-white/20 transition-all duration-300 ${
      isKeyboardVisible ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
    }`}
         style={{ left: 'calc(var(--current-tablet-sidebar-width, 60px) + 1.5rem)' }}>
      <div className="flex h-[var(--tablet-bottom-nav-h)] items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={`relative h-12 w-12 p-0 rounded-lg transition-all ${
                isActive
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => handleNavigation(item.path)}
            >
              <div className="relative flex flex-col items-center">
                <item.icon className={`h-5 w-5 ${item.colorClass || ''}`} />
                {item.badge && item.badge > 0 && (
                  <UnreadBadge 
                    count={item.badge} 
                    size="sm" 
                    className="-right-2 -top-2"
                  />
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}