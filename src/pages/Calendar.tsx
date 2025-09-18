
import React from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { UnifiedCalendar } from "@/components/calendar/UnifiedCalendar";

export default function Calendar() {
  const { language } = useTheme();

  return (
    <div className="flex-1 overflow-hidden scrollbar-hide">
      <UnifiedCalendar />
    </div>
  );
}
