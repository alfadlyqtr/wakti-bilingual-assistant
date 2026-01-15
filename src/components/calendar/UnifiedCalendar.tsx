import React, { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getDay, 
  addWeeks, subWeeks, setMonth, getMonth, startOfYear, endOfYear, 
  setYear, getYear, addYears, subYears, parse, addHours } from "date-fns";
import { toast } from "sonner";
import { arSA, enUS } from "date-fns/locale";
import { useTheme } from "@/providers/ThemeProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JournalService, JournalCheckin, JournalDay } from "@/services/journalService";
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
  Heart,
  Smartphone,
  RefreshCw
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  isNativeCalendarAvailable,
  createCalendarEvent,
  retrieveCalendars,
  getUserTimezone,
  createCalendarIfSupported
} from "@/integrations/natively/calendarBridge";
import { AppleLogo } from "./AppleLogo";
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
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [journalLatest, setJournalLatest] = useState<JournalCheckin | null>(null);
  const [journalDay, setJournalDay] = useState<JournalDay | null>(null);
  const [gestureStartY, setGestureStartY] = useState<number | null>(null);
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  
  // Phone calendar sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wakti_calendar_auto_sync') === 'true';
    } catch {
      return false;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [nativeCalendarAvailable, setNativeCalendarAvailable] = useState(false);
  
  // Check if native calendar is available on mount
  useEffect(() => {
    setNativeCalendarAvailable(isNativeCalendarAvailable());
  }, []);
  
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
    setCurrentDate(date);
    setJournalDialogOpen(false);
    setAgendaOpen(true);
  }, []);

  // Fetch journal data when the journal dialog opens
  useEffect(() => {
    const run = async () => {
      if (!journalDialogOpen || !selectedDate) return;
      const dayStr = format(selectedDate, 'yyyy-MM-dd');
      try {
        const [day, checks] = await Promise.all([
          JournalService.getDay(dayStr),
          JournalService.getCheckinsForDay(dayStr)
        ]);
        setJournalDay(day);
        setJournalLatest((checks && checks.length > 0) ? checks[0] : null);
      } catch {
        setJournalDay(null);
        setJournalLatest(null);
      }
    };
    run();
  }, [journalDialogOpen, selectedDate]);

  // Render note lines as pills (same as TimelineTab)
  const renderNotePills = (text?: string | null) => {
    if (!text) return null;
    const lines = (text || '').split('\n');
    return (
      <div className="mt-2">
        {lines.map((rawLine, idx) => {
          const i = rawLine.indexOf('|');
          if (i < 0) return <div key={`note-line-${idx}`} className="text-sm">{rawLine}</div>;
          const before = rawLine.slice(0, i);
          const after = rawLine.slice(i);
          const parts = after.split('|').map(s => s.trim());
          const markerRe = /^__FREE__(.*)__END__$/;
          let noteFreeText = '';
          const tokensRaw: string[] = [];
          for (const p of parts) {
            if (!p) continue;
            const m = p.match(markerRe);
            if (m) { noteFreeText = m[1]; continue; }
            if (p === '🕒' || p === '__UNSAVED__') continue;
            tokensRaw.push(p);
          }
          const tokens = Array.from(new Set(tokensRaw));
          return (
            <div key={`pill-${idx}`} className="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm">
              <span className="text-xs text-slate-600 mr-1">{before.match(/\[[^\]]+\]/)?.[0] || before}</span>
              <span className="sr-only"> | </span>
              <span className="inline-flex flex-wrap gap-2 align-middle">
                {tokens.map((tok, k) => (
                  <span key={`tok-${k}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{tok}</span>
                ))}
                {noteFreeText && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{noteFreeText}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

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

  // Sync calendar entries to phone calendar
  const syncToPhoneCalendar = useCallback(async () => {
    if (!nativeCalendarAvailable) {
      toast.error(language === 'ar' ? 'مزامنة التقويم متاحة فقط في التطبيق' : 'Calendar sync is only available in the app');
    }
    
    setIsSyncing(true);
    const timezone = getUserTimezone();
    let successCount = 0;
    let failCount = 0;
    
    // Sync tasks, reminders, maw3d events, and project bookings
    // Filter to only include entries with valid date strings
    const entriesToSync = calendarEntries.filter(e => 
      (e.type === EntryType.TASK || 
       e.type === EntryType.REMINDER || 
       e.type === EntryType.MAW3D_EVENT ||
       e.type === EntryType.PROJECT_BOOKING) &&
      e.date && 
      typeof e.date === 'string' &&
      e.date.length >= 10 // At least 'yyyy-MM-dd'
    );
    
    console.log('[CalendarSync] Entries to sync:', entriesToSync.length, entriesToSync.map(e => ({ title: e.title, type: e.type, date: e.date })));
    
    if (entriesToSync.length === 0) {
      setIsSyncing(false);
      toast.info(
        language === 'ar' 
          ? 'لا توجد أحداث للمزامنة. أضف مهام أو تذكيرات أو مواعيد أولاً.' 
          : 'No events to sync. Add tasks, reminders, or maw3d events first.'
      );
      return;
    }
    
    // First, retrieve available calendars from the device
    const calendarResult = await new Promise<{ calendarId: string | null; error: string | null }>((resolve) => {
      retrieveCalendars((result) => {
        console.log('[CalendarSync] Retrieved calendars result:', result);
        if (result.status === 'SUCCESS' && result.data && result.data.length > 0) {
          const waktiCalendar = result.data.find((calendar) => (calendar.name || '').toLowerCase().includes('wakti'));
          if (waktiCalendar) {
            resolve({ calendarId: waktiCalendar.id, error: null });
            return;
          }

          createCalendarIfSupported('Wakti', (createResult) => {
            if (createResult.status === 'SUCCESS' && createResult.id) {
              resolve({ calendarId: createResult.id, error: null });
            } else {
              resolve({
                calendarId: result.data?.[0]?.id || null,
                error: createResult.error || 'Unable to create Wakti calendar'
              });
            }
          });
        } else if (result.status === 'SUCCESS') {
          createCalendarIfSupported('Wakti', (createResult) => {
            if (createResult.status === 'SUCCESS' && createResult.id) {
              resolve({ calendarId: createResult.id, error: null });
            } else {
              resolve({ calendarId: null, error: createResult.error || 'Unable to create Wakti calendar' });
            }
          });
        } else {
          console.warn('[CalendarSync] Failed to retrieve calendars:', result.error);
          resolve({ calendarId: null, error: result.error || 'No calendars available' });
        }
      });
    });

    const calendarId = calendarResult.calendarId;
    console.log('[CalendarSync] Using calendar ID:', calendarId, '| Error:', calendarResult.error);
    
    // If calendar retrieval failed, show error
    if (calendarId === null) {
      setIsSyncing(false);
      const errorDetail = calendarResult.error || '';
      toast.error(
        language === 'ar' 
          ? `لا يمكن الوصول إلى التقويم: ${errorDetail}. يرجى السماح بالوصول في الإعدادات → الخصوصية → التقويمات → Wakti` 
          : `Cannot access calendar: ${errorDetail}. Please allow access in Settings → Privacy → Calendars → Wakti`
      );
      return;
    }
    
    let lastError = '';
    
    for (const entry of entriesToSync) {
      try {
        // Skip entries without a valid date string
        if (!entry.date || typeof entry.date !== 'string') {
          console.error('[CalendarSync] Entry missing date:', entry.title);
          failCount++;
          continue;
        }
        
        // Parse date safely - handle both 'yyyy-MM-dd' and ISO formats
        let entryDate: Date;
        const datePart = entry.date.split('T')[0];
        const dateParts = datePart.split('-');
        
        if (dateParts.length !== 3) {
          console.error('[CalendarSync] Invalid date format for entry:', entry.title, entry.date);
          failCount++;
          continue;
        }
        
        const [year, month, day] = dateParts.map(Number);
        
        // Validate parsed numbers
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          console.error('[CalendarSync] Could not parse date numbers for entry:', entry.title, entry.date);
          failCount++;
          continue;
        }
        
        entryDate = new Date(year, month - 1, day, 9, 0, 0); // Default to 9 AM if no time
        
        if (entry.time && typeof entry.time === 'string') {
          const timeParts = entry.time.split(':');
          if (timeParts.length >= 2) {
            const [hours, minutes] = timeParts.map(Number);
            entryDate.setHours(isNaN(hours) ? 9 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);
          }
        }
        
        // Validate date object is valid
        if (isNaN(entryDate.getTime())) {
          console.error('[CalendarSync] Invalid date for entry:', entry.title, entry.date);
          failCount++;
          continue;
        }
        
        // Clone the date to avoid mutation issues
        const startDateObj = new Date(entryDate.getTime());
        const endDateObj = addHours(new Date(entryDate.getTime()), 1);
        
        // Safe logging - don't call toISOString if date is invalid
        const safeISOString = (d: Date) => {
          try {
            return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : 'INVALID_DATE';
          } catch {
            return 'ERROR';
          }
        };
        
        console.log('[CalendarSync] Creating event:', { 
          title: entry.title, 
          startDate: safeISOString(startDateObj), 
          endDate: safeISOString(endDateObj), 
          timezone, 
          calendarId, 
          rawDate: entry.date 
        });
        
        await new Promise<void>((resolve) => {
          createCalendarEvent(
            entry.title,
            startDateObj,
            endDateObj,
            timezone,
            calendarId,
            entry.description || null,
            (result) => {
              console.log('[CalendarSync] Create event result:', result);
              if (result.status === 'SUCCESS') {
                successCount++;
              } else {
                failCount++;
                lastError = result.error || 'Unknown error';
                console.warn('[CalendarSync] Failed to sync entry:', entry.title, result.error);
              }
              resolve();
            }
          );
        });
      } catch (err) {
        failCount++;
        console.error('[CalendarSync] Error syncing entry:', entry.title, err);
      }
    }
    
    setIsSyncing(false);
    
    if (successCount > 0) {
      toast.success(
        language === 'ar' 
          ? `تمت مزامنة ${successCount} حدث إلى تقويم الهاتف` 
          : `Synced ${successCount} events to phone calendar`
      );
    }
    if (failCount > 0) {
      toast.error(
        language === 'ar' 
          ? `فشل في مزامنة ${failCount} حدث: ${lastError}` 
          : `Failed to sync ${failCount} events: ${lastError}`
      );
    }
  }, [calendarEntries, nativeCalendarAvailable, language]);

  // Handle auto-sync toggle
  const handleAutoSyncToggle = useCallback((enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    try {
      localStorage.setItem('wakti_calendar_auto_sync', enabled ? 'true' : 'false');
    } catch {}
    
    if (enabled) {
      toast.success(
        language === 'ar' 
          ? 'تم تفعيل المزامنة التلقائية' 
          : 'Auto-sync enabled'
      );
      // Trigger immediate sync when enabled
      syncToPhoneCalendar();
    } else {
      toast.info(
        language === 'ar' 
          ? 'تم إيقاف المزامنة التلقائية' 
          : 'Auto-sync disabled'
      );
    }
  }, [language, syncToPhoneCalendar]);

  // Auto-sync when calendar data changes (if enabled)
  useEffect(() => {
    if (autoSyncEnabled && nativeCalendarAvailable && calendarEntries.length > 0) {
      syncToPhoneCalendar();
    }
  }, [autoSyncEnabled, nativeCalendarAvailable, calendarEntries.length]);

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
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap justify-center">
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
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-sky-500"></div>
              <span>{language === 'ar' ? 'دفتر' : 'Journal'}</span>
            </div>
            <div className="flex items-center gap-1">
              <AppleLogo size={12} className="text-black dark:text-white" />
              <span>{language === 'ar' ? 'الهاتف' : 'Phone'}</span>
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
        
        {/* Phone Calendar Sync Section */}
        {nativeCalendarAvailable && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {language === 'ar' ? 'مزامنة تقويم الهاتف' : 'Phone Calendar Sync'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Manual sync button */}
              <Button
                variant="outline"
                size="sm"
                onClick={syncToPhoneCalendar}
                disabled={isSyncing}
                className="flex items-center gap-1"
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                <span className="hidden sm:inline">
                  {language === 'ar' ? 'مزامنة' : 'Sync'}
                </span>
              </Button>
              
              {/* Auto-sync toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'تلقائي' : 'Auto'}
                </span>
                <Switch
                  checked={autoSyncEnabled}
                  onCheckedChange={handleAutoSyncToggle}
                  aria-label={language === 'ar' ? 'المزامنة التلقائية' : 'Auto-sync'}
                />
              </div>
            </div>
          </div>
        )}
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
