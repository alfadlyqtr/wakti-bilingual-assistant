import { useState, useEffect } from "react";
import { onEvent } from "@/utils/eventBus";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { HomeScreen } from "@/components/dashboard/HomeScreen";
import { ModernHomeScreen } from "@/components/dashboard/ModernHomeScreen";
import { useWidgetManager } from "@/hooks/useWidgetManager";
import { t } from "@/utils/translations";
import { getScopedStorageItem, migrateLegacyScopedStorage, setScopedStorageItem } from "@/utils/userScopedStorage";
import { getGuestDisplayName } from "@/utils/guestAuth";

const DEFAULT_DASHBOARD_LOOK = 'modern' as const;
const parseDashboardLook = (value: unknown): 'dashboard' | 'homescreen' | 'modern' | null => {
  return value === 'dashboard' || value === 'homescreen' || value === 'modern' ? value : null;
};

export default function Dashboard() {
  const { language } = useTheme();
  const { user, isGuest } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [isDragging, setIsDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboardLook, setDashboardLook] = useState<'dashboard' | 'homescreen' | 'modern'>(() => {
    // Instant load from localStorage — no flash
    const cached = getScopedStorageItem('wakti_dashboard_look', user?.id, 'wakti_dashboard_look');
    return parseDashboardLook(cached) || DEFAULT_DASHBOARD_LOOK;
  });

  useEffect(() => {
    if (!user?.id || isGuest) return;
    migrateLegacyScopedStorage('wakti_dashboard_look', user.id, 'wakti_dashboard_look');
  }, [user?.id, isGuest]);

  // Sync from cached profile (source of truth) + cache to localStorage
  useEffect(() => {
    if (!profile) return;
    const profileLook = parseDashboardLook((profile.settings as any)?.dashboardLook);
    if (profileLook) {
      setDashboardLook(profileLook);
      setScopedStorageItem('wakti_dashboard_look', profileLook, user?.id);
      return;
    }
    const cachedLook = parseDashboardLook(getScopedStorageItem('wakti_dashboard_look', user?.id, 'wakti_dashboard_look'));
    const resolvedLook = cachedLook || DEFAULT_DASHBOARD_LOOK;
    setDashboardLook(resolvedLook);
    if (!cachedLook) {
      setScopedStorageItem('wakti_dashboard_look', resolvedLook, user?.id);
    }
  }, [profile, user?.id]);

  // Listen for dashboard look changes from Settings page
  useEffect(() => {
    const handleDashboardLookChange = (val: unknown) => {
      // Narrow eventBus payload to the strict state type before setState.
      if (val !== 'dashboard' && val !== 'homescreen' && val !== 'modern') return;
      setDashboardLook(val);
      setScopedStorageItem('wakti_dashboard_look', val, user?.id);
      setRefreshKey(prev => prev + 1);
    };
    return onEvent('dashboardLookChanged', handleDashboardLookChange);
  }, [user?.id]);

  // Add a body class while on Dashboard so CSS can hide the scrollbar for this page only
  useEffect(() => {
    document.body.classList.add('dashboard-page');
    return () => {
      document.body.classList.remove('dashboard-page');
    };
  }, []);

  // Lock the main scroll area when homescreen mode is active on /dashboard only.
  // Removed on unmount so other pages can scroll normally.
  useEffect(() => {
    if (dashboardLook === 'homescreen') {
      document.body.classList.add('homescreen-active');
    } else {
      document.body.classList.remove('homescreen-active');
    }
    if (dashboardLook === 'modern') {
      document.body.classList.add('modern-dashboard-active');
    } else {
      document.body.classList.remove('modern-dashboard-active');
    }
    return () => {
      document.body.classList.remove('homescreen-active');
      document.body.classList.remove('modern-dashboard-active');
    };
  }, [dashboardLook]);

  useEffect(() => {
    if (dashboardLook !== 'homescreen' && dashboardLook !== 'modern') return;

    const mainScroller = document.querySelector('.app-main-scroll') as HTMLElement | null;
    const mobileShell = document.querySelector('.app-layout-mobile') as HTMLElement | null;
    if (!mainScroller && !mobileShell) return;

    let startX = 0;
    let startY = 0;
    let startedNearLeftEdge = false;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startedNearLeftEdge = touch.clientX <= 24;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const primaryScroller = mainScroller || mobileShell;
      const atTop = (primaryScroller?.scrollTop || 0) <= 0;
      const isPullToRefreshGesture = atTop && deltaY > 10 && Math.abs(deltaY) > Math.abs(deltaX);
      const isLeftEdgeGesture = startedNearLeftEdge;

      if (isPullToRefreshGesture || isLeftEdgeGesture) {
        event.preventDefault();
      }
    };

    const touchOptions: AddEventListenerOptions = { passive: false };
    mainScroller?.addEventListener('touchstart', handleTouchStart, touchOptions);
    mainScroller?.addEventListener('touchmove', handleTouchMove, touchOptions);
    mobileShell?.addEventListener('touchstart', handleTouchStart, touchOptions);
    mobileShell?.addEventListener('touchmove', handleTouchMove, touchOptions);

    return () => {
      mainScroller?.removeEventListener('touchstart', handleTouchStart);
      mainScroller?.removeEventListener('touchmove', handleTouchMove);
      mobileShell?.removeEventListener('touchstart', handleTouchStart);
      mobileShell?.removeEventListener('touchmove', handleTouchMove);
    };
  }, [dashboardLook]);

  // Extract display name from LIVE profile data (never from stale user_metadata)
  // Safe fallback chain: display_name → username → email prefix → empty (loading)
  const displayName = profileLoading
    ? ''
    : (profile?.display_name ||
       profile?.username ||
       (user?.email ? user.email.split('@')[0] : '') ||
       (isGuest ? getGuestDisplayName(user, language === 'ar' ? 'ar' : 'en') : '')) || '';

  // Listen for widget settings changes from Settings page
  useEffect(() => {
    const handleWidgetSettingsChange = () => {
      console.log('Widget settings changed, refreshing dashboard');
      setRefreshKey(prev => prev + 1);
    };

    return onEvent('widgetSettingsChanged', handleWidgetSettingsChange);
  }, []);

  // Use simplified widget manager - no complex data fetching
  const {
    widgets,
    handleDragEnd
  } = useWidgetManager(language);

  // Toggle drag mode button handler
  const toggleDragMode = () => {
    const newDraggingState = !isDragging;
    setIsDragging(newDraggingState);
    if (newDraggingState) {
      toast.info(t("dragModeActivated", language));
    } else {
      toast.info(t("dragModeDeactivated", language));
    }
  };

  // Render based on dashboard look preference
  if (dashboardLook === 'homescreen') {
    return (
      <div className="w-full h-full p-0 m-0">
        <HomeScreen displayName={displayName} key={refreshKey} />
      </div>
    );
  }

  if (dashboardLook === 'modern') {
    return (
      <div className="modern-dashboard-shell w-full h-full min-h-full p-0 m-0">
        <ModernHomeScreen displayName={displayName} key={refreshKey} />
      </div>
    );
  }

  // Default dashboard look (widget grid)
  return (
    <div className="px-4 pb-4 pt-4 pr-4 dashboard-container">
        <DragModeToggle
          isDragging={isDragging}
          onToggle={toggleDragMode}
          language={language}
          displayName={displayName}
        />

        <WidgetGrid widgets={widgets} isDragging={isDragging} onDragEnd={handleDragEnd} key={refreshKey} />
    </div>
  );
}
