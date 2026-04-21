
import { useState, useEffect, useCallback, useRef } from "react";
import { getCalendarEntries, CalendarEntry, ProjectCalendarEntry } from "@/utils/calendarUtils";
import { Maw3dService } from "@/services/maw3dService";
import { TRService, TRTask, TRReminder } from "@/services/trService";
import { supabase, getCurrentUserId } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { emitEvent, onEvent } from "@/utils/eventBus";

// Identifies when any manual entries are updated from anywhere in the app
const MANUAL_ENTRIES_KEY_PREFIX = "calendarManualEntries";

type CalendarDataSnapshot = {
  maw3dEvents: any[];
  tasks: TRTask[];
  reminders: TRReminder[];
  projectCalendarEntries: ProjectCalendarEntry[];
  timestamp: number;
};

const CACHE_TTL = 5 * 60 * 1000;

const calendarDataCache = new Map<string, CalendarDataSnapshot>();
const calendarDataPromise = new Map<string, Promise<CalendarDataSnapshot>>();

const getManualEntriesStorageKey = (userId: string | null) => `${MANUAL_ENTRIES_KEY_PREFIX}:${userId || 'anonymous'}`;

const fetchProjectCalendarEntries = async (): Promise<ProjectCalendarEntry[]> => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('project_calendar_entries')
      .select('*')
      .eq('owner_id', userId)
      .order('entry_date', { ascending: true });

    if (error) {
      console.error('Error fetching project calendar entries:', error);
      return [];
    }

    return (data || []) as ProjectCalendarEntry[];
  } catch (error) {
    console.error('Error fetching project calendar entries:', error);
    return [];
  }
};

export function useCalendarData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [projectCalendarEntries, setProjectCalendarEntries] = useState<ProjectCalendarEntry[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const applySnapshot = useCallback((snapshot: CalendarDataSnapshot) => {
    setMaw3dEvents(snapshot.maw3dEvents);
    setTasks(snapshot.tasks);
    setReminders(snapshot.reminders);
    setProjectCalendarEntries(snapshot.projectCalendarEntries);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load manual entries and listen for changes from other tabs/components
  useEffect(() => {
    const storageKey = getManualEntriesStorageKey(userId);

    // Load from storage
    const loadManual = () => {
      try {
        const val = localStorage.getItem(storageKey);
        setManualEntries(val ? JSON.parse(val) : []);
      } catch {
        setManualEntries([]);
      }
    };
    loadManual();
    // Listen for storage events (cross-tab/cross-component sync)
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        loadManual();
      }
    };
    window.addEventListener("storage", onStorage);
    
    // Listen for same-tab sync events (when another hook updates manual entries)
    const unsubManual = onEvent('wakti-calendar-manual-update', (detail) => {
      if (detail?.userId === userId) {
        loadManual();
      }
    });
    
    // Listen for same-tab sync events (when another hook fetches fresh base data)
    const unsubData = onEvent('wakti-calendar-data-update', (detail) => {
      if (detail?.userId === userId) {
        const cachedSnapshot = calendarDataCache.get(userId);
        if (cachedSnapshot) {
          applySnapshot(cachedSnapshot);
          setLoading(false);
        }
      }
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      unsubManual();
      unsubData();
    };
  }, [userId, applySnapshot]);

  const updateManualEntries = useCallback((newEntries: CalendarEntry[]) => {
    if (!userId) return;
    const storageKey = getManualEntriesStorageKey(userId);

    try {
      localStorage.setItem(storageKey, JSON.stringify(newEntries));
      emitEvent('wakti-calendar-manual-update', { userId });
    } catch (error) {
      console.error('Failed to save manual calendar entries:', error);
    }

    setManualEntries(newEntries);
  }, [userId]);

  // Maw3d, Tasks, Reminders, Project Calendar Entries
  const fetchData = useCallback(async (force = false) => {
    if (!userId) {
      setMaw3dEvents([]);
      setTasks([]);
      setReminders([]);
      setProjectCalendarEntries([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const cachedSnapshot = calendarDataCache.get(userId);

    if (!force && cachedSnapshot && now - cachedSnapshot.timestamp < CACHE_TTL) {
      applySnapshot(cachedSnapshot);
      setLoading(false);
      return;
    }

    setLoading(true);

    let requestPromise: Promise<CalendarDataSnapshot> | null = null;

    try {
      const pendingPromise = calendarDataPromise.get(userId) || null;

      if (!force && pendingPromise) {
        requestPromise = pendingPromise;
      } else {
        requestPromise = Promise.all([
          Maw3dService.getUserEvents(),
          TRService.getTasks(),
          TRService.getReminders(),
          fetchProjectCalendarEntries()
        ]).then(([maw3d, taskList, rems, projectEntries]) => {
          const snapshot = {
            maw3dEvents: maw3d || [],
            tasks: taskList || [],
            reminders: rems || [],
            projectCalendarEntries: projectEntries || [],
            timestamp: Date.now()
          };

          calendarDataCache.set(userId, snapshot);
          return snapshot;
        });

        calendarDataPromise.set(userId, requestPromise);
      }

      const snapshot = await requestPromise;

      if (!mountedRef.current) return;

      applySnapshot(snapshot);
      
      // Notify other same-tab hooks that new base data is available
      emitEvent('wakti-calendar-data-update', { userId });
    } finally {
      if (calendarDataPromise.get(userId) === requestPromise) {
        calendarDataPromise.delete(userId);
      }

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applySnapshot, userId]);

  // Refresh on mount/focus
  useEffect(() => {
    fetchData();
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchData]);

  // Recompute entries on source change
  useEffect(() => {
    getCalendarEntries(manualEntries, [], maw3dEvents, tasks, reminders, [], projectCalendarEntries)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [manualEntries, maw3dEvents, tasks, reminders, projectCalendarEntries]);

  // Expose a manual refresh
  const refresh = async () => {
    await fetchData(true);
    return;
  };

  return {
    loading,
    entries,
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    projectCalendarEntries,
    refresh,
    setManualEntries: updateManualEntries
  };
}
