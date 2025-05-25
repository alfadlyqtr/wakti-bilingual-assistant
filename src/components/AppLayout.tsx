
import React from 'react';
import MobileHeader from '@/components/MobileHeader';
import MobileNav from '@/components/MobileNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MobileHeader />
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileNav />
      </div>
    </div>
  );
};
