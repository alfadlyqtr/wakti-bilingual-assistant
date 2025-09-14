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
      <div className="h-screen bg-background w-full" dir="ltr" data-layout-dir="ltr">
        {/* Sidebar remains as-is; content is padded to accommodate it */}
        <TabletSidebar />
        {/* Content column: full height, header/top + scrollable middle + bottom nav */}
        <div
          className="w-full h-screen flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-tablet-sidebar-width, 60px) + 1.5rem)' }}
        >
          {/* Header: non-shrinking */}
          <div className="flex-shrink-0">
            <TabletHeader />
          </div>
          {/* Scrollable content area between header and bottom nav */}
          <main className="flex-1 overflow-auto w-full p-4">
            <div className="w-full max-w-none">
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