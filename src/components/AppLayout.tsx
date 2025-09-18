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

// Mobile Layout Component (preserves existing mobile layout exactly)
function MobileAppLayout({ children }: AppLayoutProps) {
  // Initialize the unified notification system
  useUnreadMessages();

  return (
    <ProtectedRoute>
      {/* Flexbox container: dynamic viewport height, column direction */}
      <div className="h-[100svh] min-h-0 bg-background flex flex-col">
        {/* Global presence broadcaster */}
        <PresenceBeacon />
        {/* Header: fixed height, never shrinks */}
        <div className="flex-shrink-0">
          <AppHeader />
        </div>
        
        {/* Content area: takes remaining space, scrollable, can shrink */}
        <main className="flex-1 min-h-0 overflow-auto overscroll-none touch-manipulation pt-[var(--app-header-h)] pb-0 relative z-[1]">
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

  // On any route change, ensure global padding/keyboard vars are reset if not on Wakti AI
  useEffect(() => {
    const onRoute = () => {
      const onWaktiAI = location.pathname === "/wakti-ai";
      if (!onWaktiAI) {
        try {
          document.body.style.paddingBottom = "0px";
          document.documentElement.style.setProperty("--keyboard-height", "0px");
          document.documentElement.style.setProperty("--is-keyboard-visible", "0");
          document.documentElement.style.removeProperty("--viewport-height");
          document.documentElement.style.setProperty("--chat-input-height", "0px");
          document.documentElement.style.setProperty("--chat-input-offset", "0px");
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
