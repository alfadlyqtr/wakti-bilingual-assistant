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

    // TEMP: Diagnostics to capture state when keyboard/viewport changes
    const isLikelyIOS = () => {
      try {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      } catch { return false; }
    };
    let lastLog = 0;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const logDiagnostics = (reason: string) => {
      // Throttle to avoid noise
      const t = now();
      if (t - lastLog < 200) return;
      lastLog = t;
      try {
        const pick = (el: Element | null) => {
          if (!el) return null as any;
          const cs = getComputedStyle(el as HTMLElement);
          return {
            tag: (el as HTMLElement).tagName,
            id: (el as HTMLElement).id || undefined,
            cls: (el as HTMLElement).className || undefined,
            position: cs.position,
            transform: cs.transform,
            top: cs.top,
            bottom: cs.bottom,
            overflow: cs.overflow,
            height: cs.height,
            willChange: cs.willChange,
          };
        };
        const html = pick(document.documentElement);
        const body = pick(document.body);
        const root = pick(document.getElementById('root'));
        const header = pick(document.querySelector('.glue-top'));
        const nav = pick(document.getElementById('mobile-nav'));
        // Grouped output for easy scanning in DevTools
        // eslint-disable-next-line no-console
        console.groupCollapsed(`📐 Mobile Diagnostics: ${reason}`);
        // eslint-disable-next-line no-console
        console.log({ html, body, root, header, nav });
        // eslint-disable-next-line no-console
        console.groupEnd();
      } catch {}
    };

    // Run once on mount
    clearTransforms();
    if (isLikelyIOS()) logDiagnostics('mount');

    // Listen to viewport changes which often trigger the bug on iOS
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onVVResize = () => { clearTransforms(); if (isLikelyIOS()) logDiagnostics('visualViewport resize/scroll'); };
    const onResize = () => { clearTransforms(); if (isLikelyIOS()) logDiagnostics('window resize/orientation'); };
    const onVisibility = () => { clearTransforms(); if (isLikelyIOS()) logDiagnostics('visibility change'); };
    const onFocusIn = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as HTMLElement).isContentEditable) {
        if (isLikelyIOS()) logDiagnostics('focusin on input/textarea');
      }
    };
    const onFocusOut = () => { if (isLikelyIOS()) logDiagnostics('focusout'); };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize as any);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    if (vv) {
      vv.addEventListener('resize', onVVResize);
      vv.addEventListener('scroll', onVVResize);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
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
