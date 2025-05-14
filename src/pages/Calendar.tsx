
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import { UnifiedCalendar } from "@/components/calendar/UnifiedCalendar";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { MobileHeader } from "@/components/MobileHeader";

export default function Calendar() {
  const { language } = useTheme();

  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <MobileHeader title={t("calendar", language)} />

        <div className="flex-1 overflow-hidden pb-16">
          <UnifiedCalendar />
        </div>

        <MobileNav />
      </div>
    </TaskReminderProvider>
  );
}
