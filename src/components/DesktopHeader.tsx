import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { t } from "@/utils/translations";
import { Settings, User as Account, HelpCircle as Help, Users as Contacts, LogOut } from "lucide-react";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUserProfile } from "@/hooks/useUserProfile";
import { WeatherButton } from "@/components/WeatherButton";

export function DesktopHeader() {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadTotal } = useUnreadMessages();
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    const timestamp = avatarKey;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${timestamp}`;
  };

  // Listen for avatar update events to force refresh
  useEffect(() => {
    const handleAvatarUpdate = (event: CustomEvent) => {
      console.log('Avatar updated event received:', event.detail);
      setAvatarKey(Date.now()); // Force re-render of avatar
    };

    window.addEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdate as EventListener);
    };
  }, []);

  // Get avatar URL from profile data with cache-busting
  const avatarUrl = profile?.avatar_url ? getCacheBustedAvatarUrl(profile.avatar_url) : undefined;
  
  // Define menu items with icons
  const menuItems = [
    { 
      title: language === 'ar' ? 'الإعدادات' : 'Settings', 
      href: '/settings',
      icon: <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
    },
    { 
      title: language === 'ar' ? 'الحساب' : 'Account', 
      href: '/account',
      icon: <Account className="w-4 h-4 mr-2 text-muted-foreground" />
    },
    { 
      title: t("help", language), 
      href: '/help',
      icon: <Help className="w-4 h-4 mr-2 text-muted-foreground" />
    },
    { 
      title: language === 'ar' ? 'جهات الاتصال' : 'Contacts', 
      href: '/contacts',
      icon: <Contacts className="w-4 h-4 mr-2 text-muted-foreground" />
    },
    { 
      title: language === 'ar' ? 'تسجيل الخروج' : 'Logout', 
      onClick: handleLogout,
      icon: <LogOut className="w-4 h-4 mr-2 text-muted-foreground" />
    }
  ];

  return (
    <div className="w-full px-6 py-0 transition-all duration-300" dir="ltr">
      <div
        className="relative bg-background rounded-2xl shadow-2xl h-[var(--desktop-header-h)] flex items-center justify-between px-6 solid-bg"
      >
        {/* Glass reflection overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-30 pointer-events-none" />
        
        {/* Empty left space for balance */}
        <div className="flex-1"></div>

        <div className="flex items-center space-x-4 relative z-10">
          {/* Weather Button */}
          <div className="relative">
            <WeatherButton />
          </div>
          
          {/* Language Toggle Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleLanguage}
            className="rounded-xl h-9 px-3 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 backdrop-blur-sm shadow-lg transition-all duration-300 hover:scale-105"
            aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <span className="text-sm font-medium">
              {language === 'en' ? 'العربية' : 'English'}
            </span>
          </Button>
          
          {/* Theme Toggle Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-xl h-9 w-9 p-0 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 backdrop-blur-sm shadow-lg transition-all duration-300 hover:scale-105"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {/* User Menu */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl relative bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 backdrop-blur-sm shadow-lg transition-all duration-300 hover:scale-105"
                      style={{
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)'
                      }}>
                <span className="relative">
                  <Avatar 
                    className="h-8 w-8"
                    key={`${profile?.avatar_url || 'no-avatar'}-${avatarKey}`}
                  >
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-sm">{user?.email ? user.email[0].toUpperCase() : '?'}</AvatarFallback>
                  </Avatar>
                  <UnreadBadge count={unreadTotal} size="sm" className="-right-0.5 -top-0.5" />
                </span>
              </Button>
            </DropdownMenuTrigger>

            {/* Backdrop overlay when user menu is open */}
            {userMenuOpen && createPortal(
              <div 
                onClick={() => setUserMenuOpen(false)}
                className="fixed inset-0 z-[980] bg-background/20 backdrop-blur-sm"
              />,
              document.body
            )}

            <DropdownMenuContent 
              align="end" 
              side="bottom"
              sideOffset={8}
              collisionPadding={16}
              className="z-[1200] bg-white/95 dark:bg-[#0b0f14]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <DropdownMenuLabel>{language === 'ar' ? 'الحساب' : 'Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {menuItems.map((item, index) => (
                <DropdownMenuItem 
                  key={index} 
                  onClick={item.onClick} 
                  className={cn(item.onClick ? "cursor-pointer" : "")}
                  asChild={!!item.href}
                >
                  {item.href 
                    ? (
                      <Link to={item.href} className="flex items-center">
                        <span className="mr-2 flex items-center">{item.icon}</span>
                        {item.title}
                      </Link>
                    ) : (
                      <span className="flex items-center">
                        <span className="mr-2 flex items-center">{item.icon}</span>
                        {item.title}
                      </span>
                    )
                  }
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}