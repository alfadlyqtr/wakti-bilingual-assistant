import React from "react";
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
import { Globe, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { t } from "@/utils/translations";
import { SearchModeIndicator } from "@/components/wakti-ai-v2/SearchModeIndicator";

export function AppHeader() {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're on the Wakti AI V2 page
  const isWaktiAIPage = location.pathname === '/wakti-ai';
  
  // Get search mode state from localStorage or URL params if needed
  const [searchModeActive, setSearchModeActive] = React.useState(false);
  
  React.useEffect(() => {
    if (isWaktiAIPage) {
      // Listen for changes in AI mode from localStorage or other state management
      const checkSearchMode = () => {
        const activeTrigger = localStorage.getItem('wakti-ai-active-trigger');
        setSearchModeActive(activeTrigger === 'search');
      };
      
      checkSearchMode();
      
      // Listen for storage changes
      window.addEventListener('storage', checkSearchMode);
      
      // Custom event listener for trigger changes
      window.addEventListener('ai-trigger-change', checkSearchMode);
      
      return () => {
        window.removeEventListener('storage', checkSearchMode);
        window.removeEventListener('ai-trigger-change', checkSearchMode);
      };
    }
  }, [isWaktiAIPage]);
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string) => {
    if (!url) return url;
    const timestamp = Date.now();
    return `${url}?t=${timestamp}`;
  };

  const avatarUrl = user?.user_metadata?.avatar_url ? getCacheBustedAvatarUrl(user.user_metadata.avatar_url) : '';
  
  const menuItems = [
    { title: language === 'ar' ? 'الإعدادات' : 'Settings', href: '/settings' },
    { title: language === 'ar' ? 'الحساب' : 'Account', href: '/account' },
    { title: language === 'ar' ? 'جهات الاتصال' : 'Contacts', href: '/contacts' },
    { title: language === 'ar' ? 'تسجيل الخروج' : 'Logout', onClick: handleLogout }
  ];
  
  // Function to get page title based on current path
  const getPageTitle = () => {
    const path = location.pathname;
    
    const routes = {
      '/dashboard': language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
      '/calendar': language === 'ar' ? 'التقويم' : 'Calendar',
      '/tasks-reminders': language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders',
      '/tasks': language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders',
      '/reminders': language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders',
      '/events': language === 'ar' ? 'الأحداث' : 'Events',
      '/settings': language === 'ar' ? 'الإعدادات' : 'Settings',
      '/contacts': language === 'ar' ? 'جهات الاتصال' : 'Contacts',
      '/account': language === 'ar' ? 'الحساب' : 'Account',
      '/wakti-ai': language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      '/tasjeel': language === 'ar' ? 'تسجيل' : 'Tasjeel',
      '/event/create': language === 'ar' ? 'إنشاء حدث' : 'Create Event',
      // Maw3d routes
      '/maw3d': t("maw3dEvents", language),
      '/maw3d/create': t("createEvent", language),
    };
    
    // Check if path starts with '/event/' and is not '/event/create'
    if (path.startsWith('/event/') && path !== '/event/create') {
      return language === 'ar' ? 'تفاصيل الحدث' : 'Event Details';
    }
    
    // Check for Maw3d edit and manage routes
    if (path.startsWith('/maw3d/edit/')) {
      return t("editEvent", language);
    }
    
    if (path.startsWith('/maw3d/manage/')) {
      return t("manageEvent", language);
    }
    
    return routes[path] || '';
  };
  
  return (
    <div className="bg-background border-b sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="flex items-center">
            <Logo3D size="sm" />
          </Link>
          {getPageTitle() && (
            <h1 className="text-lg font-medium">{getPageTitle()}</h1>
          )}
          {/* Search Mode Indicator */}
          <SearchModeIndicator isVisible={isWaktiAIPage && searchModeActive} />
        </div>
        <div className="flex items-center space-x-4">
          {/* Language Toggle Button - disabled on Wakti AI page */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={isWaktiAIPage ? undefined : toggleLanguage}
                  className={cn(
                    "rounded-full",
                    isWaktiAIPage && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isWaktiAIPage}
                  aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
                >
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                </Button>
              </TooltipTrigger>
              {isWaktiAIPage && (
                <TooltipContent>
                  <p>{language === 'ar' ? 'تغيير اللغة معطل في صفحة WAKTI AI' : 'Language toggle disabled on WAKTI AI page'}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          {/* Theme Toggle Button - always functional */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="rounded-full"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>{user?.email ? user.email[0].toUpperCase() : '?'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{language === 'ar' ? 'الحساب' : 'Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {menuItems.map((item, index) => (
                <DropdownMenuItem key={index} onClick={item.onClick} className={cn(item.onClick ? "cursor-pointer" : "")} asChild={item.href ? true : false}>
                  {item.href ? <Link to={item.href}>{item.title}</Link> : item.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
