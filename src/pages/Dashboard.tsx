
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWidgetManager } from "@/hooks/useWidgetManager";
import { t } from "@/utils/translations";

export default function Dashboard() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);

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

  // Fetch dashboard data (this uses the legacy events system)
  const {
    isLoading,
    events: legacyEvents
  } = useDashboardData();

  // Manage widgets - pass legacyEvents to avoid conflicts with Maw3d system
  const {
    widgets,
    handleDragEnd
  } = useWidgetManager(language, isLoading, [], legacyEvents, []);

  // Debug logging for widget visibility
  useEffect(() => {
    console.log('Dashboard: Total widgets received from hook:', widgets.length);
    console.log('Dashboard: Widgets details:', widgets.map(w => ({
      id: w.id,
      visible: w.visible
    })));
    const visibleWidgets = widgets.filter(widget => widget.visible);
    console.log('Dashboard: Visible widgets count:', visibleWidgets.length);
    console.log('Dashboard: Visible widget IDs:', visibleWidgets.map(w => w.id));
  }, [widgets]);

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

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95">
      <div className="max-w-md mx-auto space-y-4">
        <DragModeToggle
          isDragging={isDragging}
          onToggle={toggleDragMode}
          language={language}
          displayName={displayName}
        />

        <WidgetGrid widgets={widgets} isDragging={isDragging} onDragEnd={handleDragEnd} />
        
        {/* Debug info - remove this after testing */}
        {process.env.NODE_ENV === 'development'}
      </div>
    </div>
  );
}
