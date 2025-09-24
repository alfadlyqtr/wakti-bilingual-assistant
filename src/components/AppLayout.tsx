import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";
import { PresenceBeacon } from "@/components/PresenceBeacon";

interface AppLayoutProps {
  children: React.ReactNode;
}

function MobileAppLayout({ children }: AppLayoutProps) {
  useUnreadMessages();

  return (
    <ProtectedRoute>
      <div className="app-layout-mobile bg-background">
        <PresenceBeacon />
        <div className="flex-shrink-0">
          <AppHeader />
        </div>
        <main className="flex-1 min-h-0 overflow-hidden relative z-[1] h-full">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isMobile } = useIsMobile();
  const { isTablet } = useIsTablet();
  const { isDesktop } = useIsDesktop();
  const location = useLocation();

  // Clean up any keyboard-visible class when leaving Wakti AI
  useEffect(() => {
    const onRoute = () => {
      const onWaktiAI = location.pathname === "/wakti-ai";
      if (!onWaktiAI) {
        try {
          document.body.classList.remove('keyboard-visible');
        } catch {}
      }
    };
    onRoute();
  }, [location.pathname]);

  // Conditional rendering based on screen size
  if (isMobile) {
    return <MobileAppLayout>{children}</MobileAppLayout>;
  } else if (isTablet) {
    return (
      <>
        <PresenceBeacon />
        <TabletLayout>{children}</TabletLayout>
      </>
    );
  } else {
    return (
      <>
        <PresenceBeacon />
        <DesktopLayout>{children}</DesktopLayout>
      </>
    );
  }
}
