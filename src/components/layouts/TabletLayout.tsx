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
      <div className="min-h-screen bg-background w-full">
        <TabletSidebar />
        <div className="w-full transition-all duration-300" style={{ paddingLeft: 'calc(var(--current-tablet-sidebar-width, 60px) + 1.5rem)' }}>
          <TabletHeader />
          <main className="min-h-screen w-full pt-16 p-4 pb-20">
            <div className="w-full max-w-none">
              {children}
            </div>
          </main>
          <TabletBottomNav />
        </div>
      </div>
    </ProtectedRoute>
  );
}