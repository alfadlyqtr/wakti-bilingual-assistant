
import React from "react";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarView } from "@/utils/calendarUtils";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface CalendarViewSwitcherProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  className?: string;
}

export const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({
  view,
  onViewChange,
  className
}) => {
  const { language } = useTheme();
  
  return (
    <div className={cn("flex bg-muted rounded-md p-0.5", className)}>
      <button
        onClick={() => onViewChange("month")}
        className={cn(
          "flex items-center justify-center px-2 py-1 text-xs rounded-sm",
          view === "month" ? "bg-background shadow-sm" : "text-muted-foreground"
        )}
        title={t("monthView", language)}
      >
        <Calendar className="h-4 w-4 mr-1" />
        {t("month", language)}
      </button>
      
      <button
        onClick={() => onViewChange("week")}
        className={cn(
          "flex items-center justify-center px-2 py-1 text-xs rounded-sm",
          view === "week" ? "bg-background shadow-sm" : "text-muted-foreground"
        )}
        title={t("weekView", language)}
      >
        <CalendarDays className="h-4 w-4 mr-1" />
        {t("week", language)}
      </button>
      
      <button
        onClick={() => onViewChange("year")}
        className={cn(
          "flex items-center justify-center px-2 py-1 text-xs rounded-sm",
          view === "year" ? "bg-background shadow-sm" : "text-muted-foreground"
        )}
        title={t("yearView", language)}
      >
        <CalendarRange className="h-4 w-4 mr-1" />
        {t("year", language)}
      </button>
    </div>
  );
};
