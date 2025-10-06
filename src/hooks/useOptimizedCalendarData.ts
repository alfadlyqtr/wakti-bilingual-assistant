
import { useState, useEffect, useCallback, useRef } from "react";
import { getCalendarEntries, CalendarEntry } from "@/utils/calendarUtils";
import { Maw3dService } from "@/services/maw3dService";
import { TRService, TRTask, TRReminder } from "@/services/trService";
import { useDebounced } from "./useDebounced";
import { JournalService } from "@/services/journalService";

const MANUAL_ENTRIES_KEY = "calendarManualEntries";

// Cache for preventing duplicate requests
let calendarCache: {
  maw3dEvents: any[];
  tasks: TRTask[];
  reminders: TRReminder[];
  journalOverlay: { date: string; mood_value: number | null }[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 15000; // 15 seconds

export function useOptimizedCalendarData() {
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [journalOverlay, setJournalOverlay] = useState<{ date: string; mood_value: number | null }[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Load manual entries and listen for storage changes
  useEffect(() => {
    const loadManual = () => {
      try {
        const val = localStorage.getItem(MANUAL_ENTRIES_KEY);
        const parsed = val ? JSON.parse(val) : [];
        setManualEntries(parsed);
      } catch {
        setManualEntries([]);
      }
    };
    
    loadManual();
    
    const onStorage = (e: StorageEvent) => {
      if (e.key === MANUAL_ENTRIES_KEY) {
        loadManual();
      }
    };
    
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Optimized data fetching with caching
  const fetchData = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) {
      console.log('🔄 Calendar request already in progress, skipping...');
      return;
    }

    const now = Date.now();
    if (!force && calendarCache && (now - calendarCache.timestamp) < CACHE_TTL) {
      console.log('⚡ Using cached calendar data');
      setMaw3dEvents(calendarCache.maw3dEvents);
      setTasks(calendarCache.tasks);
      setReminders(calendarCache.reminders);
      setJournalOverlay(calendarCache.journalOverlay || []);
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      
      console.log('🔄 Fetching fresh calendar data from API');
      const [maw3d, tasksData, reminderData, journalDays] = await Promise.all([
        Maw3dService.getUserEvents(),
        TRService.getTasks(),
        TRService.getReminders(),
        JournalService.getCalendarOverlay(60)
      ]);
      
      if (!mountedRef.current) return;

      // Update cache
      calendarCache = {
        maw3dEvents: maw3d || [],
        tasks: tasksData || [],
        reminders: reminderData || [],
        journalOverlay: journalDays || [],
        timestamp: now
      };

      setMaw3dEvents(maw3d || []);
      setTasks(tasksData || []);
      setReminders(reminderData || []);
      setJournalOverlay(journalDays || []);
      
      console.log('✅ Calendar data fetched and cached');
    } catch (error) {
      console.error('❌ Error fetching calendar data:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, []);

  // Debounced refresh
  const debouncedRefresh = useDebounced(fetchData, 1000);

  const refresh = useCallback(() => {
    console.log('🔄 Force refreshing calendar data');
    calendarCache = null;
    return fetchData(true);
  }, [fetchData]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Recompute entries when data changes
  useEffect(() => {
    getCalendarEntries(manualEntries, [], maw3dEvents, tasks, reminders, journalOverlay)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [manualEntries, maw3dEvents, tasks, reminders, journalOverlay]);

  // Safe manual entries setter with localStorage persistence
  const updateManualEntries = useCallback((newEntries: CalendarEntry[]) => {
    try {
      localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(newEntries));
      setManualEntries(newEntries);
      console.log('✅ Manual entries updated and saved');
    } catch (error) {
      console.error('❌ Failed to save manual entries:', error);
    }
  }, []);

  return {
    loading,
    entries,
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    journalOverlay,
    refresh,
    debouncedRefresh,
    setManualEntries: updateManualEntries
  };
}
