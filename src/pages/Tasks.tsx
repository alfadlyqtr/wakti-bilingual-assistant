
import React from "react";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";

export default function Tasks() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <MobileHeader title={t("tasks", language)} />
        <div className="flex-1 overflow-y-auto">
          <TasksAndReminders showReminders={false} />
        </div>
      </div>
    </TaskReminderProvider>
  );
}
