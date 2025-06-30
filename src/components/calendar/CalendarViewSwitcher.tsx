
import React from "react";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/utils/calendarUtils";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface CalendarViewSwitcherProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({
  view,
  onViewChange,
}) => {
  const { language } = useTheme();

  const getViewLabel = (viewType: CalendarView) => {
    switch (viewType) {
      case 'month':
        return language === 'ar' ? 'شهر' : 'Month';
      case 'week':
        return language === 'ar' ? 'أسبوع' : 'Week';
      case 'year':
        return language === 'ar' ? 'سنة' : 'Year';
      default:
        return viewType;
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {(['month', 'week', 'year'] as CalendarView[]).map((viewType) => (
        <Button
          key={viewType}
          variant={view === viewType ? "default" : "outline"}
          size="sm"
          onClick={() => onViewChange(viewType)}
          className="text-xs"
        >
          {getViewLabel(viewType)}
        </Button>
      ))}
    </div>
  );
};
