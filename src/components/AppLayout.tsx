
import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading } = useAuth();
  
  // Only initialize unread messages when user is authenticated and not loading
  const shouldInitializeUnreadMessages = user && !isLoading;
  
  // Initialize the unified notification system only when ready
  if (shouldInitializeUnreadMessages) {
    useUnreadMessages();
  }

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
