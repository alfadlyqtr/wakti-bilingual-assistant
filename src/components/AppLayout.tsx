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

  // Safety check: ensure no ancestor transform breaks fixed header/nav on iOS
  useEffect(() => {
    const clearTransforms = () => {
      try {
        const nodes: (HTMLElement | null)[] = [
          document.documentElement as HTMLElement,
          document.body as HTMLElement,
          document.getElementById('root') as HTMLElement,
        ];
        for (const el of nodes) {
          if (!el) continue;
          const cs = getComputedStyle(el);
          if (cs && cs.transform && cs.transform !== 'none') {
            el.style.transform = 'none';
            el.style.willChange = 'auto';
          }
        }
      } catch {}
    };

    // Run once on mount
    clearTransforms();

    // Listen to viewport changes which often trigger the bug on iOS
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onVVResize = () => clearTransforms();
    const onResize = () => clearTransforms();
    const onVisibility = () => clearTransforms();

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize as any);
    document.addEventListener('visibilitychange', onVisibility);
    if (vv) {
      vv.addEventListener('resize', onVVResize);
      vv.addEventListener('scroll', onVVResize);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
      document.removeEventListener('visibilitychange', onVisibility);
      if (vv) {
        vv.removeEventListener('resize', onVVResize);
        vv.removeEventListener('scroll', onVVResize);
      }
    };
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="pt-[var(--app-header-h)] pb-[var(--app-bottom-tabs-h)]">
          {children}
        </main>
        <MobileNav />
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
