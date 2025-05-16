
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  showBackButton?: boolean;
  showUserMenu?: boolean;
  onBackClick?: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function AppHeader({
  showBackButton = false,
  showUserMenu = true,
  onBackClick,
  title,
  children
}: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  // Dynamically determine the title based on the current route
  const getRouteTitle = () => {
    if (title) return title;
    
    const path = location.pathname;
    
    if (path.includes("/wakti-ai")) return "WAKTI AI";
    if (path.includes("/dashboard")) return "Dashboard";
    if (path.includes("/calendar")) return "Calendar";
    if (path.includes("/tasks")) return "Tasks";
    if (path.includes("/reminders")) return "Reminders";
    if (path.includes("/voice-summary")) return "Voice Summary";
    if (path.includes("/events")) return "Events";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/messages")) return "Messages";
    if (path.includes("/contacts")) return "Contacts";
    
    return "WAKTI";
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between p-4 border-b",
      isDark 
        ? "bg-dark-bg/90 backdrop-blur-xl border-dark-secondary/30" 
        : "bg-light-bg/90 backdrop-blur-xl border-light-secondary/40"
    )}>
      <div className="flex items-center">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="mr-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex items-center cursor-pointer" onClick={handleLogoClick}>
          <Logo3D size="sm" className="mr-2" />
          <h1 className="text-lg font-semibold">{getRouteTitle()}</h1>
        </div>
      </div>
      
      <div>
        {children ? children : showUserMenu && <UserMenu />}
      </div>
    </header>
  );
}
