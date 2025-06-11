import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWidgetManager } from "@/hooks/useWidgetManager";
export default function Dashboard() {
  const {
    language
  } = useTheme();
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);
  const [isDragging, setIsDragging] = useState(false);

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
      toast.info(language === 'ar' ? "تم تفعيل وضع السحب" : "Drag mode activated");
    } else {
      toast.info(language === 'ar' ? "تم إلغاء تفعيل وضع السحب" : "Drag mode deactivated");
    }
  };
  return <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95 scrollbar-hide">
      <div className="max-w-md mx-auto space-y-4">
        <TrialBanner trialDaysLeft={trialDaysLeft} language={language} />
        
        <DragModeToggle isDragging={isDragging} onToggle={toggleDragMode} language={language} />
        
        <WidgetGrid widgets={widgets} isDragging={isDragging} onDragEnd={handleDragEnd} />
        
        {/* Debug info - remove this after testing */}
        {process.env.NODE_ENV === 'development'}
      </div>
    </div>;
}