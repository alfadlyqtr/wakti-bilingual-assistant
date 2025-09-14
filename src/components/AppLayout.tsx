import React, { useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
}

// Mobile Layout Component (preserves existing mobile layout exactly)
function MobileAppLayout({ children }: AppLayoutProps) {
  // Initialize the unified notification system
  useUnreadMessages();

  return (
    <ProtectedRoute>
      {/* Flexbox container: full height, column direction */}
      <div className="h-screen bg-background flex flex-col">
        {/* Header: fixed height, never shrinks */}
        <div className="flex-shrink-0">
          <AppHeader />
        </div>
        
        {/* Content area: takes remaining space, scrollable */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        
        {/* Bottom nav: fixed height, never shrinks */}
        <div className="flex-shrink-0">
          <MobileNav />
        </div>
      </div>
    </ProtectedRoute>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isMobile } = useIsMobile();
  const { isTablet } = useIsTablet();
  const { isDesktop } = useIsDesktop();

  // Conditional rendering based on screen size
  if (isMobile) {
    return <MobileAppLayout>{children}</MobileAppLayout>;
  } else if (isTablet) {
    return <TabletLayout>{children}</TabletLayout>;
  } else {
    return <DesktopLayout>{children}</DesktopLayout>;
  }
}
