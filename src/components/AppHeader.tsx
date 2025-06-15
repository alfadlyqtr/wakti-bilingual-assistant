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
import { Globe, Moon, Sun, Calendar, CalendarClock, Mic, Sparkles, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { t } from "@/utils/translations";

export function AppHeader() {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we're on the Wakti AI V2 page
  const isWaktiAIPage = location.pathname === '/wakti-ai';
  
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
    { title: t("help", language), href: '/help' },
    { title: language === 'ar' ? 'جهات الاتصال' : 'Contacts', href: '/contacts' },
    { title: language === 'ar' ? 'تسجيل الخروج' : 'Logout', onClick: handleLogout }
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
        title: t("createEvent", language),
        icon: CalendarClock,
        colorClass: 'nav-icon-maw3d'
      };
    }
    
    return routes[path] || { title: '', icon: null, colorClass: '' };
  };
  
  const pageInfo = getPageTitleWithIcon();
  const IconComponent = pageInfo.icon;
  
  return (
    <div className="bg-background border-b sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center">
            <Logo3D size="sm" />
          </Link>
          {pageInfo.title && (
            <div className="flex items-center gap-2">
              {IconComponent && (
                <IconComponent className={cn("h-5 w-5", pageInfo.colorClass)} />
              )}
              <h1 className={cn("text-lg font-medium", pageInfo.colorClass)}>{pageInfo.title}</h1>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {/* Language Toggle Button - always enabled */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleLanguage}
                  className="rounded-full"
                  aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
                >
                  <Globe className="h-[1.2rem] w-[1.2rem]" />
                </Button>
              </TooltipTrigger>
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
