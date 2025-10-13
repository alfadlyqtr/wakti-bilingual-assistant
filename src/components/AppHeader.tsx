import React, { useEffect, useState, useRef } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Moon, Sun, Calendar, CalendarClock, Mic, Sparkles, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { MobileSlideDownNav } from "@/components/MobileSlideDownNav";
import { t } from "@/utils/translations";
import { Settings, User as Account, HelpCircle as Help, Users as Contacts, LogOut } from "lucide-react";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUserProfile } from "@/hooks/useUserProfile";
import { WeatherButton } from "@/components/WeatherButton";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppHeader() {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadTotal } = useUnreadMessages();
  const [avatarKey, setAvatarKey] = useState(Date.now());
  
  // Check if we're on the Wakti AI V2 page
  const isWaktiAIPage = location.pathname === '/wakti-ai';
  
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
  
  // Function to get page title and icon with matching colors from MobileNav
  const getPageTitleWithIcon = () => {
    const path = location.pathname;
    
    const routes = {
      '/dashboard': {
        title: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
        icon: null,
        colorClass: ''
      },
      '/calendar': {
        title: language === 'ar' ? 'التقويم' : 'Calendar',
        icon: Calendar,
        colorClass: 'nav-icon-calendar'
      },
      '/settings': {
        title: language === 'ar' ? 'الإعدادات' : 'Settings',
        icon: null,
        colorClass: ''
      },
      '/contacts': {
        title: language === 'ar' ? 'جهات الاتصال' : 'Contacts',
        icon: null,
        colorClass: ''
      },
      '/account': {
        title: language === 'ar' ? 'الحساب' : 'Account',
        icon: null,
        colorClass: ''
      },
      '/wakti-ai': {
        title: language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
        icon: Sparkles,
        colorClass: 'nav-icon-ai'
      },
      '/tasjeel': {
        title: language === 'ar' ? 'تسجيل' : 'Tasjeel',
        icon: Mic,
        colorClass: 'text-cyan-500' // Changed to cyan color
      },
      '/tr': {
        title: 'T & R',
        icon: ListTodo,
        colorClass: 'nav-icon-tr'
      },
      '/maw3d': {
        title: t("maw3dEvents", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      }
    };
    
    // Check for Maw3d edit and manage routes
    if (path.startsWith('/maw3d/edit/')) {
      return {
        title: t("editEvent", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }
    
    if (path.startsWith('/maw3d/manage/')) {
      return {
        title: t("manageEvent", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }

    if (path.startsWith('/maw3d/create')) {
      return {
        title: language === 'ar' ? 'إنشاء حدث' : 'Create Event',
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }
    
    return routes[path] || { title: '', icon: null, colorClass: '' };
  };
  
  const pageInfo = getPageTitleWithIcon();
  const IconComponent = pageInfo.icon;
  
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // Always starts closed
  const [logoPosition, setLogoPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useIsMobile();

  const handleLogoClick = () => {
    if (!isMobile) return;
    
    if (logoRef.current) {
      const rect = logoRef.current.getBoundingClientRect();
      setLogoPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }
    setMobileNavOpen(!mobileNavOpen);
  };

  const headerEl = (
    <header
      className={cn(
        "h-16 border-b border-border",
        "glue-fixed glue-top glue-z shadow-md",
        "solid-bg app-header-fixed",
        language === 'ar' ? 'font-arabic' : ''
      )}
      style={{
        height: 'var(--app-header-h)',
        width: '100%',
        backgroundColor: 'hsl(var(--background))'
      }}
    >
      <div className={cn(
        "container relative flex items-center justify-between",
        isMobile ? "h-14 py-3" : "h-16 py-3"
      )}>
        <div className="flex items-center gap-3">
          {isMobile ? (
            <div ref={logoRef}>
              <Logo3D size="sm" onClick={handleLogoClick} />
            </div>
          ) : (
            <Link to="/dashboard" className="flex items-center">
              <Logo3D size="sm" />
            </Link>
          )}
          {pageInfo.title && (
            <div className="flex items-center gap-2">
              {IconComponent && (
                <IconComponent className={cn("h-5 w-5", pageInfo.colorClass)} />
              )}
              <h1 className={cn("text-lg font-medium", pageInfo.colorClass)}>{pageInfo.title}</h1>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Weather Button - Made smaller */}
          <WeatherButton />
          
          {/* Language Toggle Button - always enabled */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleLanguage}
                  className="rounded-full h-8 w-8 p-0 border border-black/10 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 ring-offset-2 ring-offset-background bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 shadow-sm hover:shadow-md transition-all"
                  aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
                >
                  <span className="text-[14px] font-semibold leading-none select-none">
                    {language === 'en' ? 'ع' : 'E'}
                  </span>
                </Button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
          
          {/* Theme Toggle Button - always functional */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-full h-8 w-8 p-0"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {/* User Menu - Made smaller */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full relative">
                <span className="relative">
                  <Avatar 
                    className="h-7 w-7"
                    key={`${profile?.avatar_url || 'no-avatar'}-${avatarKey}`}
                  >
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-xs">{user?.email ? user.email[0].toUpperCase() : '?'}</AvatarFallback>
                  </Avatar>
                  <UnreadBadge count={unreadTotal} size="sm" className="-right-0.5 -top-0.5" />
                </span>
              </Button>
            </DropdownMenuTrigger>

            {/* Backdrop overlay when user menu is open - portal below header to blur page only */}
            {userMenuOpen && createPortal(
              <div 
                onClick={() => setUserMenuOpen(false)}
                className="fixed inset-0 z-[980] bg-background/20 backdrop-blur-sm pointer-events-none md:pointer-events-auto"
              />,
              document.body
            )}

            <DropdownMenuContent 
              align="end" 
              side="bottom"
              sideOffset={32}
              collisionPadding={16}
              className="z-[1200] bg-background/95 dark:bg-[#0b0f14]/95 backdrop-blur-xl border border-border/60 dark:border-white/20 md:min-w-[200px]"
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
      
      {/* Mobile Slide Down Nav */}
      {isMobile && (
        <MobileSlideDownNav 
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          logoPosition={logoPosition}
        />
      )}
    </header>
  );

  // Option A: Portal the entire header to body on mobile to avoid ancestor scroll/transform issues
  if (isMobile) {
    return createPortal(headerEl, document.body);
  }
  return headerEl;
}
