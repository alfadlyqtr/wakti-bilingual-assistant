
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
  addDays,
  getMonth,
  getYear,
  parse
} from "date-fns";
import { arSA, enUS, Locale } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarEntry, CalendarView, EntryType } from "@/utils/calendarUtils";
import { Circle, CalendarCheck, CalendarHeart, CalendarPlus, NotebookPen } from "lucide-react";
import { AppleLogo } from "./AppleLogo";

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
    const dateString = format(date, 'yyyy-MM-dd');
    const entries = calendarEntries.filter(entry => {
      const entryDatePart = entry.date.split('T')[0]; // works for both 'yyyy-MM-dd' and ISO
      if (view === 'year') {
        // Parse safely in local time to avoid UTC shifting the month/day
        let entryDt: Date;
        try {
          entryDt = parse(entryDatePart, 'yyyy-MM-dd', new Date());
        } catch {
          entryDt = new Date(entry.date);
        }
        return getMonth(entryDt) === getMonth(date) && getYear(entryDt) === getYear(date);
      }
      return entryDatePart === dateString;
    });
    
    console.log(`Entries for ${dateString}:`, entries);
    return entries;
  };
  
  // Count entries by type for a given date
  const getEntryCountByType = (date: Date) => {
    const entries = getEntriesForDate(date);
    const counts: Record<string, number> = {
      [EntryType.EVENT]: 0,
      [EntryType.APPOINTMENT]: 0,
      [EntryType.MANUAL_NOTE]: 0,
      [EntryType.MAW3D_EVENT]: 0,
      [EntryType.TASK]: 0,
      [EntryType.REMINDER]: 0,
      [EntryType.JOURNAL]: 0,
      [EntryType.PHONE_CALENDAR]: 0,
      [EntryType.PROJECT_BOOKING]: 0
    };
    
    entries.forEach(entry => {
      counts[entry.type]++;
    });
    
    return counts;
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
    const miniDayNames = Array.from({ length: 7 }).map((_, i) =>
      format(addDays(new Date(2021, 8, 5), i), 'EEEEE', { locale })
    );

    return (
      <div className="overflow-y-auto flex-1 pb-20 p-2">
        <div className="grid grid-cols-2 gap-3">
          {days.map((monthDate) => {
            const isCurrentMonth = isSameMonth(monthDate, today);
            const mStart = startOfMonth(monthDate);
            const mEnd = endOfMonth(monthDate);
            const gridStart = startOfWeek(mStart, { locale });
            const gridEnd = endOfWeek(mEnd, { locale });
            const miniDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

            return (
              <motion.div
                key={format(monthDate, 'yyyy-MM')}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setMonth(monthDate.getMonth());
                  onDayClick(newDate);
                }}
                className={cn(
                  "rounded-xl border p-2 cursor-pointer",
                  isCurrentMonth ? "border-primary bg-primary/5" : "border-border",
                  "hover:bg-accent/30"
                )}
              >
                {/* Month name */}
                <div className={cn(
                  "text-xs font-semibold text-center mb-1.5",
                  isCurrentMonth ? "text-primary" : "text-foreground"
                )}>
                  {format(monthDate, 'MMMM', { locale })}
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-0.5">
                  {miniDayNames.map((d, i) => (
                    <div key={i} className="text-center text-[8px] text-muted-foreground font-medium">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {miniDays.map((day) => {
                    const inMonth = isSameMonth(day, monthDate);
                    const isToday = isSameDay(day, today);
                    const dayEntries = calendarEntries.filter(e => {
                      const ep = e.date.split('T')[0];
                      return ep === format(day, 'yyyy-MM-dd');
                    });
                    const hasDot = dayEntries.length > 0;

                    // Pick dominant dot color
                    const dotColor = (() => {
                      if (dayEntries.some(e => e.type === EntryType.MAW3D_EVENT)) return 'bg-purple-500';
                      if (dayEntries.some(e => e.type === EntryType.TASK)) return 'bg-green-500';
                      if (dayEntries.some(e => e.type === EntryType.REMINDER)) return 'bg-red-500';
                      if (dayEntries.some(e => e.type === EntryType.JOURNAL)) return 'bg-sky-500';
                      if (dayEntries.some(e => e.type === EntryType.MANUAL_NOTE)) return 'bg-yellow-500';
                      if (dayEntries.some(e => e.type === EntryType.PHONE_CALENDAR)) return 'bg-gray-400';
                      return 'bg-blue-500';
                    })();

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "flex flex-col items-center justify-start",
                          !inMonth && "opacity-0 pointer-events-none"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] leading-tight w-4 h-4 flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground font-bold",
                          !isToday && inMonth && "text-foreground",
                        )}>
                          {format(day, 'd')}
                        </span>
                        {hasDot && inMonth && (
                          <span className={cn("w-1 h-1 rounded-full mt-px", dotColor)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
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
          const entryCounts = getEntryCountByType(day);
          const dayNumber = format(day, 'd');
          const hasAnyEntries = Object.values(entryCounts).some(count => count > 0);
          
          return (
            <motion.div
              key={day.toISOString()}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative min-h-[80px] p-1 rounded-md border",
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
              
              {hasAnyEntries && (
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {entryCounts[EntryType.MAW3D_EVENT] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-purple-500 text-purple-500" />
                      {entryCounts[EntryType.MAW3D_EVENT] > 1 && 
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.MAW3D_EVENT]}</span>
                      }
                    </div>
                  )}
                  {entryCounts[EntryType.EVENT] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                      {entryCounts[EntryType.EVENT] > 1 && 
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.EVENT]}</span>
                      }
                    </div>
                  )}
                  {entryCounts[EntryType.MANUAL_NOTE] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      {entryCounts[EntryType.MANUAL_NOTE] > 1 && 
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.MANUAL_NOTE]}</span>
                      }
                    </div>
                  )}
                  {entryCounts[EntryType.TASK] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                      {entryCounts[EntryType.TASK] > 1 && (
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.TASK]}</span>
                      )}
                    </div>
                  )}
                  {entryCounts[EntryType.REMINDER] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                      {entryCounts[EntryType.REMINDER] > 1 && (
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.REMINDER]}</span>
                      )}
                    </div>
                  )}
                  {entryCounts[EntryType.JOURNAL] > 0 && (
                    <div className="flex items-center">
                      <Circle className="h-3 w-3 fill-sky-500 text-sky-500" />
                      {entryCounts[EntryType.JOURNAL] > 1 && (
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.JOURNAL]}</span>
                      )}
                    </div>
                  )}
                  {entryCounts[EntryType.PHONE_CALENDAR] > 0 && (
                    <div className="flex items-center">
                      <AppleLogo size={16} className="text-black dark:text-white" />
                      {entryCounts[EntryType.PHONE_CALENDAR] > 1 && (
                        <span className="text-xs ml-0.5">{entryCounts[EntryType.PHONE_CALENDAR]}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
