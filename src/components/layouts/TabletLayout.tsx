import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TabletHeader } from "@/components/TabletHeader";
import { TabletSidebar } from "@/components/TabletSidebar";
import { TabletBottomNav } from "@/components/TabletBottomNav";
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
        {/* Sidebar remains as-is; content is padded to accommodate it */}
        <TabletSidebar />
        {/* Content column: full height, header/top + scrollable middle + bottom nav */}
        <div
          className="w-full h-screen flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-tablet-sidebar-width, 60px) + 1.5rem)' }}
        >
          {/* Header: fixed position, separate from scrollable content */}
          <header className="fixed-header">
            <TabletHeader />
          </header>
          {/* Scrollable content area between header and bottom nav - account for elevated header */}
          <main className="flex-1 overflow-auto w-full p-3 sm:p-4 pt-[calc(var(--tablet-header-h,56px)+1rem)]">
            <div className="w-full max-w-full">
              {children}
            </div>
          </main>
          {/* Bottom nav: non-shrinking */}
          <div className="flex-shrink-0">
            <TabletBottomNav />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}