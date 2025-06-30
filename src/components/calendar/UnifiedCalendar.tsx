import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getDay, 
  addWeeks, subWeeks, setMonth, getMonth, startOfYear, endOfYear, 
  setYear, getYear, addYears, subYears, parse } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { CalendarControls } from "./CalendarControls";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarAgenda } from "./CalendarAgenda";
import { CalendarEntryDialog } from "./CalendarEntryDialog";
import { CalendarViewSwitcher } from "./CalendarViewSwitcher";
import { CalendarEntry, CalendarView, EntryType } from "@/utils/calendarUtils";
import { useOptimizedCalendarData } from "@/hooks/useOptimizedCalendarData";
import { 
  Drawer, 
  DrawerContent, 
  DrawerTrigger, 
  DrawerClose
} from "@/components/ui/drawer";
import { 
  Calendar as CalendarIcon,
  ChevronLeft, 
  ChevronRight, 
  Plus,
  ChevronDown,
  CheckSquare,
  Bell,
  PinIcon,
  Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const UnifiedCalendar: React.FC = React.memo(() => {
  const { language, theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CalendarEntry | null>(null);
  const [gestureStartY, setGestureStartY] = useState<number | null>(null);
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  
  // Use optimized calendar data hook to prevent freezing!
  const {
    entries: calendarEntries,
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    refresh: refreshCalendarData,
    setManualEntries,
    loading,
  } = useOptimizedCalendarData();
  
  // Get the appropriate locale based on the selected language
  const locale = language === 'ar' ? arSA : enUS;

  // Generate month options for the select
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(i);
    return {
      value: i.toString(),
      label: format(date, 'MMMM', { locale }),
    };
  });

  // Generate year options (past 2 years, current year, future 5 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => {
    const year = currentYear - 2 + i;
    return {
      value: year.toString(),
      label: year.toString(),
    };
  });

  // Handle navigation between dates
  const navigatePrevious = useCallback(() => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else if (view === 'year') {
      setCurrentDate(subYears(currentDate, 1));
    }
  }, [view, currentDate]);

  const navigateNext = useCallback(() => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (view === 'year') {
      setCurrentDate(addYears(currentDate, 1));
    }
  }, [view, currentDate]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }, []);

  // Handle month change from dropdown
  const handleMonthChange = useCallback((value: string) => {
    const newMonth = parseInt(value, 10);
    const newDate = setMonth(currentDate, newMonth);
    setCurrentDate(newDate);
  }, [currentDate]);

  // Handle year change from dropdown
  const handleYearChange = useCallback((value: string) => {
    const newYear = parseInt(value, 10);
    const newDate = setYear(currentDate, newYear);
    setCurrentDate(newDate);
  }, [currentDate]);

  // touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - track for double tap
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < 300) {
        // Double tap detected - switch view
        cycleView();
        
        // Clear any existing timeout to prevent multiple actions
        if (doubleTapTimeoutRef.current) {
          clearTimeout(doubleTapTimeoutRef.current);
          doubleTapTimeoutRef.current = null;
        }
      } else {
        // Set up potential double tap
        lastTapRef.current = now;
      }
      
      setGestureStartY(e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      // Pinch gesture - calculate distance for pinch-to-zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchStartDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistance !== null) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      // If pinching out (zoom in)
      if (currentDistance - pinchStartDistance > 50) {
        if (view === 'year') {
          setView('month');
        } else if (view === 'month') {
          setView('week');
        }
        setPinchStartDistance(null);
      }
      // If pinching in (zoom out)
      else if (pinchStartDistance - currentDistance > 50) {
        if (view === 'week') {
          setView('month');
        } else if (view === 'month') {
          setView('year');
        }
        setPinchStartDistance(null);
      }
    }
  };

  const handleTouchEnd = () => {
    setGestureStartY(null);
    setPinchStartDistance(null);
  };

  // Handle day selection
  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date); // Update current date when clicking a day
    setAgendaOpen(true);
  }, []);

  // Add a new manual calendar entry - optimized to prevent freezing
  const addManualEntry = useCallback((entry: Omit<CalendarEntry, 'id'>) => {
    const newEntry: CalendarEntry = {
      ...entry,
      id: `manual-${Date.now()}`,
      type: EntryType.MANUAL_NOTE,
    };
    console.log('Adding new manual entry:', newEntry);
    const updatedEntries = [...manualEntries, newEntry];
    setManualEntries(updatedEntries);
    setEntryDialogOpen(false);
  }, [manualEntries, setManualEntries]);

  // Edit a manual calendar entry - optimized
  const updateManualEntry = useCallback((entry: CalendarEntry) => {
    console.log('Updating manual entry:', entry);
    const updatedEntries = manualEntries.map(e => e.id === entry.id ? entry : e);
    setManualEntries(updatedEntries);
    setEditEntry(null);
    setEntryDialogOpen(false);
  }, [manualEntries, setManualEntries]);

  // Delete a manual calendar entry - optimized
  const deleteManualEntry = useCallback((entryId: string) => {
    console.log('Deleting manual entry with ID:', entryId);
    const updatedEntries = manualEntries.filter(entry => entry.id !== entryId);
    setManualEntries(updatedEntries);
    setEditEntry(null);
    setEntryDialogOpen(false);
  }, [manualEntries, setManualEntries]);

  // Open dialog to edit an entry
  const handleEditEntry = useCallback((entry: CalendarEntry) => {
    if (entry.type === EntryType.MANUAL_NOTE) {
      setEditEntry(entry);
      setEntryDialogOpen(true);
    }
  }, []);

  const cycleView = useCallback(() => {
    setView(prev => {
      if (prev === 'month') return 'week';
      if (prev === 'week') return 'year';
      return 'month';
    });
  }, []);

  return (
    <div 
      className="flex flex-col h-full w-full overflow-hidden" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex flex-col space-y-2 p-3">
        {/* Date selector with dropdowns */}
        <div className="flex items-center justify-center w-full">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={navigatePrevious}
              className={cn(language === 'ar' ? 'order-2' : 'order-1')}
            >
              <ChevronLeft className={cn("h-5 w-5", language === 'ar' && "rotate-180")} />
            </Button>
            
            <div className={cn("flex items-center space-x-1", 
              language === 'ar' ? 'order-1 flex-row-reverse' : 'order-2')}>
              <Select 
                value={getMonth(currentDate).toString()}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue>
                    {format(currentDate, 'MMMM', { locale })}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={getYear(currentDate).toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue>
                    {format(currentDate, 'yyyy', { locale })}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={navigateNext}
              className={cn(language === 'ar' ? 'order-1' : 'order-3')}
            >
              <ChevronRight className={cn("h-5 w-5", language === 'ar' && "rotate-180")} />
            </Button>
          </div>
        </div>

        {/* Updated Legend with proper color coding */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>{language === 'ar' ? 'مواعيد' : 'Maw3d'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>{language === 'ar' ? 'يدوي' : 'Manual'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>{language === 'ar' ? 'مهام' : 'Tasks'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>{language === 'ar' ? 'تذكيرات' : 'Reminders'}</span>
            </div>
          </div>
        </div>
        
        {/* View switcher and action buttons */}
        <div className="flex items-center justify-between">
          <CalendarViewSwitcher 
            view={view} 
            onViewChange={setView}
          />
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToToday}
            >
              {t("today", language)}
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                setEditEntry(null);
                setEntryDialogOpen(true);
              }}
              title={t("create", language)}
              className="fixed bottom-24 right-4 z-10 rounded-full shadow-lg h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      <CalendarGrid
        currentDate={currentDate}
        selectedDate={selectedDate}
        calendarEntries={calendarEntries}
        view={view}
        onDayClick={handleDayClick}
        language={language}
        locale={locale}
      />

      <Drawer open={agendaOpen} onOpenChange={setAgendaOpen}>
        <DrawerTrigger asChild>
          <div />
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <div className="p-4">
            {selectedDate && (
              <CalendarAgenda 
                date={selectedDate}
                entries={calendarEntries}
                onClose={() => setAgendaOpen(false)}
                onEditEntry={handleEditEntry}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <CalendarEntryDialog
        isOpen={entryDialogOpen}
        onClose={() => {
          setEntryDialogOpen(false);
          setEditEntry(null);
        }}
        onSave={editEntry ? updateManualEntry : addManualEntry}
        onDelete={editEntry ? deleteManualEntry : undefined}
        initialDate={selectedDate || new Date()}
        entry={editEntry}
      />
    </div>
  );
});

UnifiedCalendar.displayName = 'UnifiedCalendar';

export default UnifiedCalendar;
