
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
  
  // Initialize the unified notification system when user is ready
  // This prevents the conditional hooks issue
  const unreadMessages = useUnreadMessages();

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
