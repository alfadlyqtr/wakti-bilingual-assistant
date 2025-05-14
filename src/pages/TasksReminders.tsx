
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import TasksAndReminders from "@/components/tasks/TasksAndReminders";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { MobileHeader } from "@/components/MobileHeader";

export default function TasksReminders() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <MobileHeader title={t("taskAndReminders", language)} />

        <div className="flex-1 overflow-hidden">
          <TasksAndReminders />
        </div>

        <MobileNav />
      </div>
    </TaskReminderProvider>
  );
}
