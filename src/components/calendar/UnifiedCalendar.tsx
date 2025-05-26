import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getDay, 
  addWeeks, subWeeks, setMonth, getMonth, startOfYear, endOfYear, 
  setYear, getYear, addYears, subYears, parse } from "date-fns";
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
import { Maw3dService } from "@/services/maw3dService";
import { Maw3dEvent } from "@/types/maw3d";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const UnifiedCalendar: React.FC = () => {
  const { language, theme } = useTheme();
  const { tasks, reminders } = useTaskReminder();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState<Maw3dEvent[]>([]);
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

  // Load manual entries from local storage
  useEffect(() => {
    console.log('Loading manual entries from localStorage...');
    const savedEntries = localStorage.getItem('calendarManualEntries');
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        console.log('Loaded manual entries from localStorage:', parsed);
        setManualEntries(parsed);
      } catch (error) {
        console.error('Error parsing manual entries from localStorage:', error);
        setManualEntries([]);
      }
    } else {
      console.log('No manual entries found in localStorage');
      setManualEntries([]);
    }
  }, []);

  // Fetch Maw3d events
  useEffect(() => {
    const fetchMaw3dEvents = async () => {
      try {
        console.log('Fetching Maw3d events for calendar...');
        const events = await Maw3dService.getUserEvents();
        console.log('Fetched Maw3d events:', events.length);
        setMaw3dEvents(events);
      } catch (error) {
        console.error('Error fetching Maw3d events:', error);
        setMaw3dEvents([]);
      }
    };

    fetchMaw3dEvents();
  }, []);

  // Save manual entries to local storage whenever they change
  useEffect(() => {
    console.log('Saving manual entries to localStorage:', manualEntries);
    localStorage.setItem('calendarManualEntries', JSON.stringify(manualEntries));
  }, [manualEntries]);

  // Calculate all calendar entries from tasks, reminders, events, maw3d events and manual entries
  useEffect(() => {
    console.log('Calculating calendar entries with:', {
      tasks: tasks.length,
      reminders: reminders.length,
      maw3dEvents: maw3dEvents.length,
      manualEntries: manualEntries.length
    });
    
    // Log manual entries for debugging
    manualEntries.forEach((entry, index) => {
      console.log(`Manual entry ${index}:`, entry);
    });
    
    const entries = getCalendarEntries(tasks, reminders, manualEntries, [], maw3dEvents);
    console.log('Total calendar entries after combination:', entries.length);
    
    // Log entries by type for debugging
    const taskEntries = entries.filter(e => e.type === EntryType.TASK);
    const reminderEntries = entries.filter(e => e.type === EntryType.REMINDER);
    const manualEntriesFiltered = entries.filter(e => e.type === EntryType.MANUAL_NOTE);
    const maw3dEntriesFiltered = entries.filter(e => e.type === EntryType.MAW3D_EVENT);
    
    console.log('Entries breakdown:', {
      tasks: taskEntries.length,
      reminders: reminderEntries.length,
      manual: manualEntriesFiltered.length,
      maw3d: maw3dEntriesFiltered.length
    });
    
    setCalendarEntries(entries);
  }, [tasks, reminders, manualEntries, maw3dEvents]);

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

  // Handle month change from dropdown
  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value, 10);
    const newDate = setMonth(currentDate, newMonth);
    setCurrentDate(newDate);
  };

  // Handle year change from dropdown
  const handleYearChange = (value: string) => {
    const newYear = parseInt(value, 10);
    const newDate = setYear(currentDate, newYear);
    setCurrentDate(newDate);
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
    console.log('Adding new manual entry:', newEntry);
    setManualEntries(prev => {
      const updated = [...prev, newEntry];
      console.log('Updated manual entries array:', updated);
      return updated;
    });
    setEntryDialogOpen(false);
  };

  // Edit a manual calendar entry
  const updateManualEntry = (entry: CalendarEntry) => {
    console.log('Updating manual entry:', entry);
    setManualEntries(prev => {
      const updated = prev.map(e => e.id === entry.id ? entry : e);
      console.log('Updated manual entries after edit:', updated);
      return updated;
    });
    setEditEntry(null);
    setEntryDialogOpen(false);
  };

  // Delete a manual calendar entry
  const deleteManualEntry = (entryId: string) => {
    console.log('Deleting manual entry with ID:', entryId);
    setManualEntries(prev => {
      const updated = prev.filter(entry => entry.id !== entryId);
      console.log('Updated manual entries after delete:', updated);
      return updated;
    });
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

        {/* Legend */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>{t("tasks", language)}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Maw3d</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>{t("reminders", language)}</span>
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
};
