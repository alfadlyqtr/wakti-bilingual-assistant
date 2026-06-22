import React, { useState, useEffect } from "react";
import { onEvent } from "@/utils/eventBus";
import { TabletHeader } from "@/components/TabletHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { useLocation } from "react-router-dom";
import { getScopedStorageItem } from "@/utils/userScopedStorage";
import { useUserProfile } from "@/hooks/useUserProfile";

interface TabletLayoutProps {
  children: React.ReactNode;
}

const DEFAULT_DASHBOARD_LOOK = 'modern' as const;
const parseDashboardLook = (value: unknown): 'dashboard' | 'homescreen' | 'modern' | null => {
  return value === 'dashboard' || value === 'homescreen' || value === 'modern' ? value : null;
};

export function TabletLayout({ children }: TabletLayoutProps) {
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
        <TabletHeader />
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  if (isHomescreenLook) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-background w-full" dir="ltr">
        <header className="fixed-header"><TabletHeader /></header>
        <main className="min-h-0 flex-1 overflow-auto w-full p-3 sm:p-4 mt-[calc(var(--tablet-header-h,56px)+1.5rem)]">
          <div className="w-full max-w-full">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-background w-full app-layout-tablet" dir="ltr" data-layout-dir="ltr">
      {/* Sidebar: use the same component as desktop for consistent visuals/behavior */}
      <DesktopSidebar />
      {/* Content column: full height, header/top + scrollable middle */}
      <div
        className="w-full h-full min-h-0 flex flex-col transition-all duration-300"
        style={{ paddingLeft: 'calc(var(--current-sidebar-width, 240px) + 0.75rem)' }}
      >
        {/* Header: fixed position, separate from scrollable content */}
        <header className="fixed-header">
          <TabletHeader />
        </header>
        {/* Scrollable content area - starts below fixed header */}
        <main className="min-h-0 flex-1 overflow-auto w-full p-3 sm:p-4 mt-[calc(var(--tablet-header-h,56px)+1.5rem)]">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}