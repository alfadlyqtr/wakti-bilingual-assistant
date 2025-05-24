
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import UnifiedCalendar from "@/components/calendar/UnifiedCalendar";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";

export default function Calendar() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="flex-1 overflow-hidden">
        <UnifiedCalendar />
      </div>
    </TaskReminderProvider>
  );
}
