
import React from "react";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";

export default function Reminders() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <MobileHeader title={t("reminders", language)} />
        <div className="flex-1 overflow-y-auto">
          <TasksAndReminders showTasks={false} />
        </div>
      </div>
    </TaskReminderProvider>
  );
}
