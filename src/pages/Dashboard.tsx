
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWidgetManager } from "@/hooks/useWidgetManager";

export default function Dashboard() {
  const { language } = useTheme();
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);
  const [isDragging, setIsDragging] = useState(false);
  
  // Fetch dashboard data
  const { isLoading, tasks, events, reminders } = useDashboardData();
  
  // Manage widgets
  const { widgets, handleDragEnd } = useWidgetManager(language, isLoading, tasks, events, reminders);

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

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28">
      <TrialBanner trialDaysLeft={trialDaysLeft} language={language} />
      
      <DragModeToggle 
        isDragging={isDragging} 
        onToggle={toggleDragMode} 
        language={language} 
      />
      
      <WidgetGrid 
        widgets={widgets} 
        isDragging={isDragging} 
        onDragEnd={handleDragEnd} 
      />
    </div>
  );
}
