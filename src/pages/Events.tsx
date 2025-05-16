
import React from "react";
import EventsPage from "@/components/events/EventsPage";
import { TaskReminderProvider } from "@/contexts/TaskReminderContext";
import { MobileHeader } from "@/components/MobileHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MobileNav } from "@/components/MobileNav";

export default function Events() {
  const { language } = useTheme();
  
  return (
    <TaskReminderProvider>
      <div className="mobile-container">
        <MobileHeader title={t("events", language)} />
        <div className="flex-1 overflow-y-auto pb-16">
          <EventsPage />
        </div>
        <MobileNav />
      </div>
    </TaskReminderProvider>
  );
}
