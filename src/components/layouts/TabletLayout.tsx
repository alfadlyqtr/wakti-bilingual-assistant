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
      <div className="min-h-screen bg-background flex w-full">
        <TabletSidebar />
        <div className="flex-1 flex flex-col transition-all duration-300" style={{ marginLeft: 'calc(var(--current-tablet-sidebar-width, 60px) + 1.5rem)' }}>
          <TabletHeader />
          <main className="flex-1 pt-16 pb-[var(--tablet-bottom-nav-h)] p-4">
            {children}
          </main>
          <TabletBottomNav />
        </div>
      </div>
    </ProtectedRoute>
  );
}