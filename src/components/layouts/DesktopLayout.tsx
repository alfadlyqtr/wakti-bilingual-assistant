import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DesktopHeader } from "@/components/DesktopHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useLocation } from "react-router-dom";

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  useUnreadMessages();
  const location = useLocation();
  const [dashboardLook, setDashboardLook] = useState<string>(
    () => localStorage.getItem('wakti_dashboard_look') || 'homescreen'
  );

  useEffect(() => {
    const handler = (e: CustomEvent) => setDashboardLook(e.detail);
    window.addEventListener('dashboardLookChanged', handler as EventListener);
    return () => window.removeEventListener('dashboardLookChanged', handler as EventListener);
  }, []);

  const isHomescreenMode = location.pathname === '/dashboard' && dashboardLook === 'homescreen';
  const isHomescreenNav   = location.pathname === '/settings'  && dashboardLook === 'homescreen';

  if (isHomescreenMode) {
    return (
      <ProtectedRoute>
        <div className="h-screen overflow-hidden flex flex-col bg-background w-full" dir="ltr">
          <DesktopHeader />
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            {children}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (isHomescreenNav) {
    return (
      <ProtectedRoute>
        <div className="h-screen overflow-hidden flex flex-col bg-background w-full" dir="ltr">
          <header className="fixed-header"><DesktopHeader /></header>
          <main className="app-main flex-1 overflow-auto w-full p-4 md:p-6 mt-[calc(var(--desktop-header-h,60px)+1.5rem)]">
            <div className="w-full max-w-full">{children}</div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="h-screen overflow-hidden flex bg-background w-full app-layout-desktop" dir="ltr" data-layout-dir="ltr">
        {/* Sidebar remains fixed at left; content area is padded to accommodate it */}
        <DesktopSidebar />
        {/* Content column: full height flex with header and scrollable main */}
        <div
          className="w-full h-full min-h-0 flex flex-col transition-all duration-300"
          style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 0.5rem)' }}
        >
          {/* Header: fixed position, separate from scrollable content */}
          <header className="fixed-header">
            <DesktopHeader />
          </header>
          {/* Scrollable content area - starts below fixed header */}
          <main className="app-main min-h-0 flex-1 overflow-auto w-full p-4 md:p-6 mt-[calc(var(--desktop-header-h,60px)+1.5rem)]">
            <div className="w-full max-w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}