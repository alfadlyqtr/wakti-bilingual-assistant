
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { useWidgetManager } from "@/hooks/useWidgetManager";
import { t } from "@/utils/translations";

export default function Dashboard() {
  const { language } = useTheme();
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="p-4 space-y-4" key={refreshKey}>
      <div className="max-w-md mx-auto space-y-4">
        <DragModeToggle
          isDragging={isDragging}
          onToggle={toggleDragMode}
          language={language}
          displayName={displayName}
        />

        <WidgetGrid widgets={widgets} isDragging={isDragging} onDragEnd={handleDragEnd} />
      </div>
    </div>
  );
}
