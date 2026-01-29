import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabletHeader } from "@/components/TabletHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface TabletLayoutProps {
  children: React.ReactNode;
}

export function TabletLayout({ children }: TabletLayoutProps) {
  // Initialize the unified notification system
  useUnreadMessages();

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background w-full app-layout-tablet overflow-hidden" dir="ltr" data-layout-dir="ltr">
        {/* Sidebar: use the same component as desktop for consistent visuals/behavior */}
        <DesktopSidebar />
        {/* Content column: full height, header/top + scrollable middle */}
        <div
          className="w-full h-screen flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 0.75rem)' }}
        >
          {/* Header: fixed position, separate from scrollable content */}
          <header className="fixed-header">
            <TabletHeader />
          </header>
          {/* Scrollable content area - starts below fixed header */}
          <main className="flex-1 overflow-auto w-full p-3 sm:p-4 mt-[calc(var(--tablet-header-h,56px)+1.5rem)] h-[calc(100vh-var(--tablet-header-h,56px)-1.5rem)]">
            <div className="w-full max-w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}