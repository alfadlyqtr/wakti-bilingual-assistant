
import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Always call the hook unconditionally - moved conditional logic inside the hook
  useUnreadMessages();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="pb-16">
          {children}
        </main>
        <MobileNav />
      </div>
    </ProtectedRoute>
  );
}
