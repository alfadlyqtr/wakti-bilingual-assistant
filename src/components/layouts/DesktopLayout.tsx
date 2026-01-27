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
      <div className="h-screen bg-background w-full app-layout-desktop overflow-hidden" dir="ltr" data-layout-dir="ltr">
        {/* Sidebar remains fixed at left; content area is padded to accommodate it */}
        <DesktopSidebar />
        {/* Content column: full height flex with header and scrollable main */}
        <div
          className="w-full h-screen flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 0.5rem)' }}
        >
          {/* Header: fixed position, separate from scrollable content */}
          <header className="fixed-header">
            <DesktopHeader />
          </header>
          {/* Scrollable content area - account for elevated header */}
          <main className="app-main flex-1 overflow-auto w-full p-4 md:p-6 pt-[calc(var(--desktop-header-h,60px)+2rem)] h-[calc(100vh-var(--desktop-header-h,60px))]">
            <div className="w-full max-w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}