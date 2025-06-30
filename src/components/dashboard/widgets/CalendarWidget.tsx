
import React from "react";
import { Button } from "@/components/ui/button";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, Calendar, Clock } from "lucide-react";
import { useCalendarData } from "@/hooks/useCalendarData";

interface CalendarWidgetProps {
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ language }) => {
  const navigate = useNavigate();
  const { entries, loading } = useCalendarData();

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

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
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
            {/* Today & Tomorrow Preview */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 p-3 rounded-xl bg-blue-500 text-white text-center relative">
                <div className="font-bold text-lg">{format(new Date(), "d")}</div>
                <div className="text-xs opacity-90">{t("today", language)}</div>
                {todayEntries.length > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {todayEntries.length}
                  </div>
                )}
              </div>
              <div className="flex-1 p-3 rounded-xl bg-white border border-blue-500/20 text-blue-500 text-center relative">
                <div className="font-bold text-lg">{format(addDays(new Date(), 1), "d")}</div>
                <div className="text-xs opacity-90">{t("tomorrow", language)}</div>
                {tomorrowEntries.length > 0 && (
                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {tomorrowEntries.length}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Events Preview */}
            {upcomingEntries.length > 0 ? (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {language === 'ar' ? 'الأحداث القادمة' : 'Upcoming'}
                </h4>
                {upcomingEntries.slice(0, 2).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                    <Clock className="h-3 w-3 text-blue-500 flex-shrink-0" />
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
            ) : (
              <div className="text-center py-2 mb-4">
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'لا توجد أحداث قادمة' : 'No upcoming events'}
                </p>
              </div>
            )}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all duration-300"
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
};
