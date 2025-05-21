
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
import { Globe, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo3D } from "@/components/Logo3D";
import { t } from "@/utils/translations";

export function AppHeader() {
  const { theme, setTheme, language, setLanguage, toggleLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  const menuItems = [
    { title: language === 'ar' ? 'الإعدادات' : 'Settings', href: '/settings' },
    { title: language === 'ar' ? 'الرسائل' : 'Messages', href: '/messages' },
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
      '/messages': language === 'ar' ? 'الرسائل' : 'Messages',
      '/contacts': language === 'ar' ? 'جهات الاتصال' : 'Contacts',
      '/account': language === 'ar' ? 'الحساب' : 'Account',
      '/wakti-ai': language === 'ar' ? 'WAKTI AI' : 'WAKTI AI',
      '/tasjeel': language === 'ar' ? 'تسجيل' : 'Tasjeel',
      '/event/create': language === 'ar' ? 'إنشاء حدث' : 'Create Event',
    };
    
    // Check if path starts with '/event/' and is not '/event/create'
    if (path.startsWith('/event/') && path !== '/event/create') {
      return language === 'ar' ? 'تفاصيل الحدث' : 'Event Details';
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
        </div>
        <div className="flex items-center space-x-4">
          {/* Language Toggle Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleLanguage}
            className="rounded-full"
            aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
          >
            <Globe className="h-[1.2rem] w-[1.2rem]" />
          </Button>
          
          {/* Theme Toggle Button */}
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
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
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
