import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DesktopHeader } from "@/components/DesktopHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  // Initialize the unified notification system
  useUnreadMessages();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background w-full">
        <DesktopSidebar />
        <div className="w-full transition-all duration-300" style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 2rem)' }}>
          <DesktopHeader />
          <main className="min-h-screen w-full pt-20 p-6 pb-8">
            <div className="w-full max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}