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

  // ENFORCE SCROLLING on all pages and fix any bottom space
  useEffect(() => {
    // Force scrolling on every page change
    document.body.style.cssText = '';
    document.documentElement.style.cssText = '';
    
    // Reset all CSS custom properties
    document.documentElement.style.removeProperty('--chat-input-height');
    document.documentElement.style.removeProperty('--chat-input-offset');
    document.documentElement.style.removeProperty('--keyboard-height');
    document.documentElement.style.removeProperty('--visual-viewport-height');
    document.documentElement.style.removeProperty('--is-keyboard-visible');
    
    // Ensure body has no restriction on scrolling
    document.body.classList.remove('keyboard-visible');
    document.body.classList.add('force-scroll');
    
    // Small delay to make sure styles are applied
    const timeout = setTimeout(() => {
      document.body.classList.remove('force-scroll');
    }, 100);
    
    return () => clearTimeout(timeout);
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
