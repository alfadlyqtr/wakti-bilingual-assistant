import React, { useState, useEffect } from "react";
import { onEvent } from "@/utils/eventBus";
import { DesktopHeader } from "@/components/DesktopHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useLocation } from "react-router-dom";
import { getScopedStorageItem } from "@/utils/userScopedStorage";
import { useUserProfile } from "@/hooks/useUserProfile";

interface DesktopLayoutProps {
  children: React.ReactNode;
}

const DEFAULT_DASHBOARD_LOOK = 'modern' as const;
const parseDashboardLook = (value: unknown): 'dashboard' | 'homescreen' | 'modern' | null => {
  return value === 'dashboard' || value === 'homescreen' || value === 'modern' ? value : null;
};

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const location = useLocation();
  const { profile } = useUserProfile();
  const [dashboardLook, setDashboardLook] = useState<'dashboard' | 'homescreen' | 'modern'>(
    () => parseDashboardLook(getScopedStorageItem('wakti_dashboard_look', undefined, 'wakti_dashboard_look')) || DEFAULT_DASHBOARD_LOOK
  );

  useEffect(() => {
    const profileLook = parseDashboardLook((profile?.settings as any)?.dashboardLook);
    if (profileLook) {
      setDashboardLook(profileLook);
      return;
    }
    const cachedLook = parseDashboardLook(getScopedStorageItem('wakti_dashboard_look', undefined, 'wakti_dashboard_look'));
    setDashboardLook(cachedLook || DEFAULT_DASHBOARD_LOOK);
  }, [profile]);

  useEffect(() => {
    return onEvent('dashboardLookChanged', (detail) => {
      const nextLook = parseDashboardLook(detail);
      if (nextLook) setDashboardLook(nextLook);
    });
  }, []);

  const isHomescreenLook = dashboardLook === 'homescreen';
  const isDashboard       = location.pathname === '/dashboard';

  if (isHomescreenLook && isDashboard) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-background w-full" dir="ltr">
        <DesktopHeader />
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  if (isHomescreenLook) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-background w-full" dir="ltr">
        <header className="fixed-header"><DesktopHeader /></header>
        <main className="app-main flex-1 overflow-auto w-full p-4 md:p-6 mt-[calc(var(--desktop-header-h,60px)+1.5rem)]">
          <div className="w-full max-w-full">{children}</div>
        </main>
      </div>
    );
  }

  return (
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
  );
}