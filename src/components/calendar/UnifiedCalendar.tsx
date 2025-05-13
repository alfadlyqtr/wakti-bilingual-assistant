
import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getDay, 
  addWeeks, subWeeks, setMonth, getMonth, startOfYear, endOfYear, 
  setYear, getYear, addYears, subYears } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { useTaskReminder } from "@/contexts/TaskReminderContext";
import { t } from "@/utils/translations";
import { CalendarControls } from "./CalendarControls";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarAgenda } from "./CalendarAgenda";
import { CalendarEntryDialog } from "./CalendarEntryDialog";
import { CalendarViewSwitcher } from "./CalendarViewSwitcher";
import { getCalendarEntries, CalendarEntry, CalendarView, EntryType } from "@/utils/calendarUtils";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const UnifiedCalendar: React.FC = () => {
  const { language, theme } = useTheme();
  const { tasks, reminders } = useTaskReminder();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CalendarEntry | null>(null);
  const [gestureStartY, setGestureStartY] = useState<number | null>(null);
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  // Get the appropriate locale based on the selected language
  const locale = language === 'ar' ? arSA : enUS;

  // Load manual entries from local storage
  useEffect(() => {
    const savedEntries = localStorage.getItem('calendarManualEntries');
    if (savedEntries) {
      setManualEntries(JSON.parse(savedEntries));
    }
  }, []);

  // Save manual entries to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('calendarManualEntries', JSON.stringify(manualEntries));
  }, [manualEntries]);

  // Calculate all calendar entries from tasks, reminders, events and manual entries
  useEffect(() => {
    const entries = getCalendarEntries(tasks, reminders, manualEntries);
    setCalendarEntries(entries);
  }, [tasks, reminders, manualEntries]);

  // Handle navigation between dates
  const navigatePrevious = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else if (view === 'year') {
      setCurrentDate(subYears(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (view === 'year') {
      setCurrentDate(addYears(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Handle touch gestures for view switching
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

  // Cycle through calendar views
  const cycleView = useCallback(() => {
    setView(prev => {
      if (prev === 'month') return 'week';
      if (prev === 'week') return 'year';
      return 'month';
    });
  }, []);

  // Handle day selection
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date); // Update current date when clicking a day
    setAgendaOpen(true);
  };

  // Add a new manual calendar entry
  const addManualEntry = (entry: Omit<CalendarEntry, 'id'>) => {
    const newEntry: CalendarEntry = {
      ...entry,
      id: `manual-${Date.now()}`,
      type: EntryType.MANUAL_NOTE,
    };
    setManualEntries(prev => [...prev, newEntry]);
    setEntryDialogOpen(false);
  };

  // Edit a manual calendar entry
  const updateManualEntry = (entry: CalendarEntry) => {
    setManualEntries(prev => 
      prev.map(e => e.id === entry.id ? entry : e)
    );
    setEditEntry(null);
    setEntryDialogOpen(false);
  };

  // Delete a manual calendar entry
  const deleteManualEntry = (entryId: string) => {
    setManualEntries(prev => prev.filter(entry => entry.id !== entryId));
    setEditEntry(null);
    setEntryDialogOpen(false);
  };

  // Open dialog to edit an entry
  const handleEditEntry = (entry: CalendarEntry) => {
    if (entry.type === EntryType.MANUAL_NOTE) {
      setEditEntry(entry);
      setEntryDialogOpen(true);
    }
  };

  return (
    <div 
      className="flex flex-col h-full w-full overflow-hidden" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={navigatePrevious}
            className={cn(language === 'ar' ? 'order-2' : 'order-1')}
          >
            <ChevronLeft className={cn("h-5 w-5", language === 'ar' && "rotate-180")} />
          </Button>
          
          <div className={cn("text-lg font-semibold px-2 flex-1 text-center", 
            language === 'ar' ? 'order-1' : 'order-2')}>
            {format(currentDate, 
              view === 'year' 
                ? 'yyyy' 
                : view === 'month' 
                  ? 'MMMM yyyy' 
                  : 'dd MMM yyyy', 
              { locale }
            )}
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

        <div className="flex items-center gap-2">
          <CalendarViewSwitcher 
            view={view} 
            onViewChange={setView}
            className="ml-auto"
          />
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
          >
            <Plus className="h-5 w-5" />
          </Button>
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

      <div className={cn("fixed bottom-20 left-0 right-0 flex justify-center z-10", 
        agendaOpen && "hidden")}>
        <Button 
          onClick={goToToday}
          variant="default"
          className="rounded-full px-4 py-2 shadow-lg"
        >
          {t("today", language)}
        </Button>
      </div>

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
};
