
import React from "react";
import EventsPage from "@/components/events/EventsPage";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function Events() {
  const { language } = useTheme();
  
  return (
    <TaskReminderProvider>
      <div className="flex-1 overflow-y-auto pb-16">
        <EventsPage />
      </div>
    </TaskReminderProvider>
  );
}
