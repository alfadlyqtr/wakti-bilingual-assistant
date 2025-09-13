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
      <div className="min-h-screen bg-background flex w-full">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col">
          <DesktopHeader />
          <main className="flex-1 pt-[var(--desktop-header-h)] p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}