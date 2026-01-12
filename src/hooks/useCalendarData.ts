
import { useState, useEffect, useCallback } from "react";
import { getCalendarEntries, CalendarEntry, ProjectCalendarEntry } from "@/utils/calendarUtils";
import { Maw3dService } from "@/services/maw3dService";
import { TRService, TRTask, TRReminder } from "@/services/trService";
import { supabase, getCurrentUserId } from "@/integrations/supabase/client";

// Identifies when any manual entries are updated from anywhere in the app
const MANUAL_ENTRIES_KEY = "calendarManualEntries";

export function useCalendarData() {
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [projectCalendarEntries, setProjectCalendarEntries] = useState<ProjectCalendarEntry[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load manual entries and listen for changes from other tabs/components
  useEffect(() => {
    // Load from storage
    const loadManual = () => {
      try {
        const val = localStorage.getItem(MANUAL_ENTRIES_KEY);
        setManualEntries(val ? JSON.parse(val) : []);
      } catch {
        setManualEntries([]);
      }
    };
    loadManual();
    // Listen for storage events (cross-tab/cross-component sync)
    const onStorage = (e: StorageEvent) => {
      if (e.key === MANUAL_ENTRIES_KEY) {
        loadManual();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fetch project calendar entries
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

  // Maw3d, Tasks, Reminders, Project Calendar Entries
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [maw3d, tasks, rems, projectEntries] = await Promise.all([
        Maw3dService.getUserEvents(),
        TRService.getTasks(),
        TRService.getReminders(),
        fetchProjectCalendarEntries()
      ]);
      setMaw3dEvents(maw3d || []);
      setTasks(tasks || []);
      setReminders(rems || []);
      setProjectCalendarEntries(projectEntries || []);
    } finally {
      setLoading(false);
    }
  }, []);

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
    await fetchData();
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
    setManualEntries
  };
}
