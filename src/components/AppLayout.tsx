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
        <main className="flex-1 min-h-0 overflow-hidden relative z-[1]">
          <div className="chat-messages-container h-full">
            {children}
          </div>
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
