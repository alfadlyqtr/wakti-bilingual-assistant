
import React from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  startOfYear,
  endOfYear,
  setMonth,
  getDay,
  addDays
} from "date-fns";
import { arSA, enUS, Locale } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarEntry, CalendarView, EntryType } from "@/utils/calendarUtils";

interface CalendarGridProps {
  currentDate: Date;
  selectedDate: Date | null;
  calendarEntries: CalendarEntry[];
  view: CalendarView;
  onDayClick: (date: Date) => void;
  language: 'en' | 'ar';
  locale: Locale;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  selectedDate,
  calendarEntries,
  view,
  onDayClick,
  language,
  locale
}) => {
  const today = new Date();
  
  // Generate days based on the current view
  const days = React.useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart, { locale });
      const endDate = endOfWeek(monthEnd, { locale });
      
      return eachDayOfInterval({ start: startDate, end: endDate });
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { locale });
      const weekEnd = endOfWeek(currentDate, { locale });
      
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else if (view === 'year') {
      // For year view, we'll show 12 months
      return Array.from({ length: 12 }).map((_, i) => {
        return setMonth(currentDate, i);
      });
    }
    
    return [];
  }, [currentDate, view, locale]);
  
  // Get entries for a specific date
  const getEntriesForDate = (date: Date) => {
    return calendarEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return view === 'year'
        ? getMonth(entryDate) === getMonth(date) && getYear(entryDate) === getYear(date)
        : isSameDay(entryDate, date);
    });
  };
  
  // First day of week should be Sunday for English, Saturday for Arabic
  const dayNames = React.useMemo(() => {
    const firstDayOfWeek = language === 'en' ? 0 : 6; // 0 = Sunday, 6 = Saturday
    return Array.from({ length: 7 }).map((_, i) => {
      const day = (i + firstDayOfWeek) % 7;
      return format(addDays(new Date(2021, 8, 5), day), 'EEEEE', { locale });
    });
  }, [language, locale]);

  if (view === 'year') {
    return (
      <div className="grid grid-cols-3 gap-2 p-2 overflow-y-auto flex-1 pb-20">
        {days.map((month) => {
          const entries = getEntriesForDate(month);
          const hasEntries = entries.length > 0;
          const isCurrentMonth = isSameMonth(month, today);
          
          return (
            <motion.div
              key={format(month, 'MMM')}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(month.getMonth());
                onDayClick(newDate);
              }}
              className={cn(
                "p-2 rounded-md text-center border",
                isCurrentMonth && "bg-primary/10 border-primary",
                !isCurrentMonth && "border-border",
                "cursor-pointer hover:bg-accent/50",
              )}
            >
              <div className="font-medium">{format(month, 'MMM', { locale })}</div>
              
              {hasEntries && (
                <div className="flex justify-center gap-1 mt-1">
                  {entries.some(e => e.type === EntryType.TASK) && (
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  )}
                  {entries.some(e => e.type === EntryType.EVENT) && (
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  )}
                  {entries.some(e => e.type === EntryType.REMINDER) && (
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  )}
                  {entries.some(e => e.type === EntryType.MANUAL_NOTE) && (
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Week day names */}
      <div 
        className={cn(
          "grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1", 
          language === 'ar' ? 'rtl' : 'ltr'
        )}
      >
        {dayNames.map((day, index) => (
          <div key={index} className="h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar days */}
      <div 
        className={cn(
          "grid grid-cols-7 gap-1 p-1",
          language === 'ar' ? 'rtl' : 'ltr',
          view === 'week' && "grid-cols-7 h-full"
        )}
      >
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const entries = getEntriesForDate(day);
          const dayNumber = format(day, 'd');
          
          return (
            <motion.div
              key={day.toISOString()}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative min-h-[90px] p-1 rounded-md border",
                !isCurrentMonth && view === 'month' && "opacity-40 bg-background/50",
                isToday && "border-primary",
                isSelected && "bg-primary/10",
                !isSelected && !isToday && "border-border",
                "overflow-hidden",
                "cursor-pointer hover:bg-accent/50",
                view === 'week' && "flex flex-col h-full"
              )}
            >
              <div className={cn(
                "text-right text-sm font-medium mb-1 flex justify-end",
                isToday && "text-primary"
              )}>
                {isToday ? (
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
                    {dayNumber}
                  </span>
                ) : (
                  dayNumber
                )}
              </div>
              
              <div className="flex flex-col gap-1 overflow-hidden">
                {entries.slice(0, 3).map((entry) => {
                  const entryColor = 
                    entry.type === EntryType.TASK ? "bg-green-500" :
                    entry.type === EntryType.EVENT ? "bg-blue-500" :
                    entry.type === EntryType.REMINDER ? "bg-red-500" :
                    "bg-yellow-500";
                  
                  return (
                    <div 
                      key={entry.id} 
                      className={cn(
                        "text-xs truncate px-1 py-0.5 rounded",
                        entryColor,
                        "text-white"
                      )}
                      title={entry.title}
                    >
                      {entry.title}
                    </div>
                  );
                })}
                
                {entries.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{entries.length - 3} more
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
