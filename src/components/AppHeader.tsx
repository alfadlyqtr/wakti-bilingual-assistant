
import React from "react";
import { Link, useNavigate } from "react-router-dom";
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

export function AppHeader() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
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
  
  return (
    <div className="bg-background border-b sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          Wakti.AI
        </Link>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
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
