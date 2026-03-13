import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { HomeScreen } from "@/components/dashboard/HomeScreen";
import { useWidgetManager } from "@/hooks/useWidgetManager";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/utils/translations";

export default function Dashboard() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboardLook, setDashboardLook] = useState<'dashboard' | 'homescreen'>(() => {
    // Instant load from localStorage — no flash
    const cached = localStorage.getItem('wakti_dashboard_look');
    return cached === 'homescreen' ? 'homescreen' : 'dashboard';
  });

  // Sync from Supabase (source of truth) + cache to localStorage
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .single();
        const savedLook = (profile?.settings as any)?.dashboardLook;
        if (savedLook === 'dashboard' || savedLook === 'homescreen') {
          setDashboardLook(savedLook);
          localStorage.setItem('wakti_dashboard_look', savedLook);
        }
      } catch { /* silent */ }
    })();
  }, [user]);

  // Listen for dashboard look changes from Settings page
  useEffect(() => {
    const handleDashboardLookChange = (e: CustomEvent) => {
      const val = e.detail;
      setDashboardLook(val);
      localStorage.setItem('wakti_dashboard_look', val);
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('dashboardLookChanged', handleDashboardLookChange as EventListener);
    return () => window.removeEventListener('dashboardLookChanged', handleDashboardLookChange as EventListener);
  }, []);

  // Add a body class while on Dashboard so CSS can hide the scrollbar for this page only
  useEffect(() => {
    document.body.classList.add('dashboard-page');
    return () => {
      document.body.classList.remove('dashboard-page');
    };
  }, []);

  // Lock the main scroll area when homescreen mode is active
  useEffect(() => {
    if (dashboardLook === 'homescreen') {
      document.body.classList.add('homescreen-active');
    } else {
      document.body.classList.remove('homescreen-active');
    }
    return () => {
      document.body.classList.remove('homescreen-active');
    };
  }, [dashboardLook]);

  // Extract display name or fallback to email/first char
  let displayName = '';
  if (user?.user_metadata) {
    displayName =
      user.user_metadata.display_name ||
      user.user_metadata.full_name ||
      user.user_metadata.username ||
      (user.email ? user.email.split("@")[0] : "");
    // fallback so username doesn't appear empty
    if (!displayName && user.email) {
      displayName = user.email.split("@")[0];
    }
  }

  // Listen for widget settings changes from Settings page
  useEffect(() => {
    const handleWidgetSettingsChange = () => {
      console.log('Widget settings changed, refreshing dashboard');
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('widgetSettingsChanged', handleWidgetSettingsChange);
    
    return () => {
      window.removeEventListener('widgetSettingsChanged', handleWidgetSettingsChange);
    };
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
      <div className="dashboard-container" key={refreshKey} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <HomeScreen displayName={displayName} />
      </div>
    );
  }

  // Default dashboard look (widget grid)
  return (
    <div className="px-4 pb-4 pt-4 pr-4 dashboard-container" key={refreshKey}>
        <DragModeToggle
          isDragging={isDragging}
          onToggle={toggleDragMode}
          language={language}
          displayName={displayName}
        />

        <WidgetGrid widgets={widgets} isDragging={isDragging} onDragEnd={handleDragEnd} />
    </div>
  );
}
