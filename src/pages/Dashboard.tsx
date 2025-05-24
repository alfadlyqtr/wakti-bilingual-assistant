
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { DragModeToggle } from "@/components/dashboard/DragModeToggle";
import WidgetGrid from "@/components/dashboard/WidgetGrid";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWidgetManager } from "@/hooks/useWidgetManager";

export default function Dashboard() {
  const { language } = useTheme();
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);
  const [dragMode, setDragMode] = useState(false);
  
  // Use widget manager hook
  const { layouts, widgets, saveLayouts, updateWidgetVisibility } = useWidgetManager();

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28">
      <TrialBanner trialDaysLeft={trialDaysLeft} language={language} />
      
      <WidgetGrid 
        dragMode={dragMode}
        setDragMode={setDragMode}
      />
    </div>
  );
}
