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
      <div className="h-screen bg-background w-full app-layout-desktop" dir="ltr" data-layout-dir="ltr">
        {/* Sidebar remains fixed at left; content area is padded to accommodate it */}
        <DesktopSidebar />
        {/* Content column: full height flex with header and scrollable main */}
        <div
          className="w-full h-screen flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 2rem)' }}
        >
          {/* Header: non-shrinking */}
          <div className="flex-shrink-0">
            <DesktopHeader />
          </div>
          {/* Scrollable content area */}
          <main className="flex-1 overflow-auto w-full p-6 pt-6">
            <div className="w-full max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}