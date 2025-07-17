import React from 'react';
import { UserMenu } from '@/components/navigation/UserMenu';
import { NotificationBadges } from './NotificationBadges';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';

export const NavigationHeader = () => {
  const { theme, language } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            WAKTI
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <NotificationBadges />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
