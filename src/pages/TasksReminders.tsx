
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";

export default function TasksReminders() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="flex-1 overflow-hidden scrollbar-hide">
        <TasksAndReminders showTasks={true} showReminders={true} />
      </div>
    </TaskReminderProvider>
  );
}
