import React, { useState, useEffect, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { UnreadProvider, useUnreadContext } from "@/contexts/UnreadContext";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { setupNotificationClickHandler } from "@/integrations/natively/notificationsBridge";
import { onEvent } from "@/utils/eventBus";
import { toast } from "sonner";

const CustomPaywallModal = lazy(() => import("@/components/paywall/CustomPaywallModal"));
const AnnouncementRunner = lazy(() => import("@/components/announcements/AnnouncementRunner").then((m) => ({ default: m.AnnouncementRunner })));

interface AppLayoutProps {
  children?: React.ReactNode;
}
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <UnreadProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </UnreadProvider>
  );
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const unreadData = useUnreadContext();
  const { user } = useAuth();

  const { language } = useTheme();
  const navigate = useNavigate();

  // Trial limit bouncer — during 24h trial, show friendly bilingual toast (NOT the full paywall)
  React.useEffect(() => {
    const offLimitReached = onEvent('wakti-trial-limit-reached', ({ feature, reason }) => {
      const msg = (() => {
        if (language === 'ar') {
          if (reason === 'feature_locked') return 'هذه الميزة غير مشمولة في تجربة الـ 24 ساعة. اشترك لفتحها.';
          if (reason === 'trial_expired') return 'انتهت تجربة الـ 24 ساعة. اشترك للمتابعة من الحساب والفوترة.';
          return 'لقد استخدمت حصتك المجانية لهذه الميزة. اشترك للمتابعة بدون حدود.';
        }

        if (reason === 'feature_locked') return 'This feature is not included in the 24-hour trial. Subscribe to unlock it.';
        if (reason === 'trial_expired') return 'Your 24-hour trial has ended. Subscribe from Account & Billing to continue.';
        return 'You used your free quota for this feature. Subscribe to continue without limits.';
      })();

      toast.error(msg, {
        duration: 6500,
        id: `trial-limit-${feature || 'unknown'}`,
        action: {
          label: language === 'ar' ? 'الفوترة' : 'Billing',
          onClick: () => navigate('/account?tab=billing'),
        },
      });
    });

    const offQuotaFinished = onEvent('wakti-trial-quota-finished', ({ feature }) => {
      const msg = language === 'ar'
        ? 'استخدمت آخر محاولة مجانية لهذه الميزة. للاستخدام القادم اشترك من الحساب والفوترة.'
        : 'You just used your last free try for this feature. For the next one, subscribe in Account & Billing.';

      toast.message(msg, {
        duration: 6500,
        id: `trial-finished-${feature || 'unknown'}`,
        action: {
          label: language === 'ar' ? 'اشترك' : 'Subscribe',
          onClick: () => navigate('/account?tab=billing'),
        },
      });
    });

    return () => {
      offLimitReached();
      offQuotaFinished();
    };
  }, [language, navigate]);

  // Unified notification system - subscribes to notification_history for all notification types
  // including task_due, reminder_due, messages, contacts, RSVPs, etc.
  // This hook automatically shows in-app toasts when new notifications arrive
  useNotificationHistory();
  
  // Set up push notification click handler (Natively/OneSignal)
  // This handles navigation when user taps a push notification
  React.useEffect(() => {
    setupNotificationClickHandler(navigate);
  }, [navigate]);

  const { isMobile } = useIsMobile();
  const { isTablet } = useIsTablet();
  const { isDesktop } = useIsDesktop();
  const location = useLocation();

  // LIGHTWEIGHT CLEANUP - preserves styling
  React.useEffect(() => {
    // Clean up only problematic CSS properties
    document.documentElement.style.removeProperty('--chat-input-height');
    document.documentElement.style.removeProperty('--keyboard-height');
    document.documentElement.style.removeProperty('--visual-viewport-height');
    
    // Remove keyboard-visible class
    document.body.classList.remove('keyboard-visible');
    
    // Ensure bottom space is gone
    document.body.style.paddingBottom = '0';
    document.body.style.marginBottom = '0';
    
    return () => {};
  }, [location.pathname]);
  
  // Consolidate body class tagging based on route
  React.useEffect(() => {
    const path = location.pathname;

    // Determine states
    const isDashboardPage = path === '/' || path === '/dashboard';
    const isWaktiAIPage = path === '/wakti-ai';
    const isProjectDetailPage = path.startsWith('/projects/') && path.length > 11;

    // Apply dashboard class
    if (isDashboardPage) document.body.classList.add('dashboard-page');
    else document.body.classList.remove('dashboard-page');

    // Apply wakti-ai class
    if (isWaktiAIPage) document.body.classList.add('wakti-ai-page');
    else document.body.classList.remove('wakti-ai-page');

    // Apply project-detail class
    if (isProjectDetailPage) document.body.classList.add('project-detail-page');
    else document.body.classList.remove('project-detail-page');

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('dashboard-page', 'wakti-ai-page', 'project-detail-page');
    };
  }, [location.pathname]);

  React.useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.removeAttribute('data-aria-hidden');
    document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => el.removeAttribute('data-aria-hidden'));
  }, [location.pathname]);

  // Content: use children if provided (legacy), otherwise use Outlet for nested routes
  const content = children || <Outlet />;

  if (isMobile) {
    return (
      <>
        {/* When paywall is open, disable header interactions and keep it under the modal */}
        <style>
          {`
            body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
          `}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <div className="h-[100dvh] bg-background app-layout-mobile overflow-x-hidden flex flex-col">
            <AppHeader unreadTotal={unreadData.unreadTotal} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden app-main-scroll">
              {content}
            </main>
            <PresenceBeacon />
            <Suspense fallback={null}>
              <AnnouncementRunner />
            </Suspense>
          </div>
        </ProtectedRoute>
      </>
    );
  }

  if (isTablet) {
    return (
      <>
        <style>
          {`body.paywall-open [data-radix-popper-content-wrapper]{z-index:1200 !important;}`}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <PresenceBeacon />
          <TabletLayout>{content}</TabletLayout>
          <Suspense fallback={null}>
            <AnnouncementRunner />
          </Suspense>
        </ProtectedRoute>
      </>
    );
  }

  // Desktop
  return (
    <>
      <style>
        {`
          body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
        `}
      </style>
      <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
        <PresenceBeacon />
        <DesktopLayout>{content}</DesktopLayout>
        <Suspense fallback={null}>
          <AnnouncementRunner />
        </Suspense>
      </ProtectedRoute>
    </>
  );
}
