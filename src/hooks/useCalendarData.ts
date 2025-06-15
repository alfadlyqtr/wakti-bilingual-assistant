
import { useState, useEffect, useCallback } from "react";
import { getCalendarEntries, CalendarEntry } from "@/utils/calendarUtils";
import { Maw3dService } from "@/services/maw3dService";
import { TRService, TRTask, TRReminder } from "@/services/trService";

// Identifies when any manual entries are updated from anywhere in the app
const MANUAL_ENTRIES_KEY = "calendarManualEntries";

export function useCalendarData() {
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
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

  // Maw3d, Tasks, Reminders (refetch when tab gets focus as backup)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [maw3d, tasks, rems] = await Promise.all([
        Maw3dService.getUserEvents(),
        TRService.getTasks(),
        TRService.getReminders()
      ]);
      setMaw3dEvents(maw3d || []);
      setTasks(tasks || []);
      setReminders(rems || []);
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

  // Optionally: subscribe to real-time events here for auto-refresh
  
  // Recompute entries on source change
  useEffect(() => {
    getCalendarEntries(manualEntries, [], maw3dEvents, tasks, reminders)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [manualEntries, maw3dEvents, tasks, reminders]);

  // Expose a manual refresh
  const refresh = async () => {
    await fetchData();
    // manualEntries is kept by storage event if changed
    return;
  };

  return {
    loading,
    entries,
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    refresh,
    setManualEntries // for manual entry creation/editing
  };
}
