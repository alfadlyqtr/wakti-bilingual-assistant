
import React from "react";
import { Button } from "@/components/ui/button";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, Calendar, Clock } from "lucide-react";
import { useOptimizedCalendarData } from "@/hooks/useOptimizedCalendarData";
import { EntryType } from "@/utils/calendarUtils";
import { useWidgetDragHandle } from "@/components/dashboard/WidgetDragHandleContext";

interface CalendarWidgetProps {
  language: 'en' | 'ar';
}

// Color mapping for different entry types
const getEntryColor = (type: EntryType) => {
  switch (type) {
    case EntryType.MAW3D_EVENT:
      return '#8B5CF6'; // Purple
    case EntryType.MANUAL_NOTE:
      return '#F59E0B'; // Yellowish
    case EntryType.TASK:
      return '#10B981'; // Green
    case EntryType.REMINDER:
      return '#EF4444'; // Red
    default:
      return '#6B7280'; // Gray fallback
  }
};

export const CalendarWidget: React.FC<CalendarWidgetProps> = React.memo(({ language }) => {
  const navigate = useNavigate();
  const { entries, loading } = useOptimizedCalendarData();
  const { registerHandle, listeners, attributes, isDragging } = useWidgetDragHandle();
  const handleBindings = isDragging ? { ...attributes, ...listeners } : {};
  const handleClass = isDragging
    ? `absolute top-2 z-20 p-2 rounded-lg border border-blue-400/50 bg-blue-500/30 text-blue-50 shadow-lg ring-2 ring-blue-400/60 transition-all duration-300 scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`
    : `absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 bg-primary/20 border-primary/30 transition-all duration-300 hover:bg-primary/30 hover:text-white ${language === 'ar' ? 'right-2' : 'left-2'}`;

  // Get upcoming entries for next 3 days
  const upcomingEntries = entries
    .filter(entry => {
      const entryDate = new Date(entry.date);
      const today = new Date();
      const threeDaysFromNow = addDays(today, 3);
      return entryDate >= today && entryDate <= threeDaysFromNow;
    })
    .slice(0, 3);

  const todayEntries = entries.filter(entry => isToday(new Date(entry.date)));
  const tomorrowEntries = entries.filter(entry => isTomorrow(new Date(entry.date)));

  // Count entries by type for today
  const todayByType = todayEntries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<EntryType, number>);

  // Count entries by type for tomorrow
  const tomorrowByType = tomorrowEntries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<EntryType, number>);

  // Get formatted day names
  const todayDayName = format(new Date(), "EEEE", { locale: language === 'ar' ? ar : undefined });
  const tomorrowDayName = format(addDays(new Date(), 1), "EEEE", { locale: language === 'ar' ? ar : undefined });

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background - Always showing enhanced colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 rounded-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-transparent to-purple-500/15 rounded-xl"></div>
      
      {/* Drag handle with glass effect - Always enhanced */}
      <div
        ref={registerHandle}
        {...handleBindings}
        className={`${handleClass} cursor-grab active:cursor-grabbing`}
      >
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {format(new Date(), "MMMM yyyy")}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Today & Tomorrow Preview with Color-coded dots */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 p-3 rounded-xl bg-blue-500 text-white text-center relative">
                <div className="font-bold text-lg">{format(new Date(), "d")}</div>
                <div className="text-xs opacity-90">{`${t("today", language)} - ${todayDayName}`}</div>
                {todayEntries.length > 0 && (
                  <div className="absolute -top-1 -right-1 flex flex-wrap gap-1">
                    {Object.entries(todayByType).map(([type, count]) => (
                      <div
                        key={type}
                        className="text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: getEntryColor(type as EntryType) }}
                      >
                        {count}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 p-3 rounded-xl bg-white border border-blue-500/20 text-blue-500 text-center relative">
                <div className="font-bold text-lg">{format(addDays(new Date(), 1), "d")}</div>
                <div className="text-xs opacity-90">{`${t("tomorrow", language)} - ${tomorrowDayName}`}</div>
                {tomorrowEntries.length > 0 && (
                  <div className="absolute -top-1 -right-1 flex flex-wrap gap-1">
                    {Object.entries(tomorrowByType).map(([type, count]) => (
                      <div
                        key={type}
                        className="text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: getEntryColor(type as EntryType) }}
                      >
                        {count}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Events Preview with color-coded indicators */}
            {upcomingEntries.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {language === 'ar' ? 'الأحداث القادمة' : 'Upcoming'}
                </h4>
                {upcomingEntries.slice(0, 2).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                    <div 
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getEntryColor(entry.type) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.date), "MMM d")}
                        {entry.time && ` • ${entry.time}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 bg-blue-500/20 border-blue-500/40 transition-all duration-300"
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
});

CalendarWidget.displayName = 'CalendarWidget';
