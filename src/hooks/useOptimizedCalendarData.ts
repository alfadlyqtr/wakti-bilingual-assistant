
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService } from '@/services/trService';
import { CalendarEntry } from '@/utils/calendarUtils';

export function useOptimizedCalendarData() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [manualEntries, setManualEntries] = useState<CalendarEntry[]>([]);
  const [maw3dEvents, setMaw3dEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      // Sequential loading to prevent auth stampede
      const tasksData = await TRService.getTasks(user.id);
      const remindersData = await TRService.getReminders(user.id);

      setTasks(tasksData);
      setReminders(remindersData);
      setEvents([]); // Events will be loaded separately
      setMaw3dEvents([]); // Maw3d events will be loaded separately
      
      // Combine all entries
      const allEntries = [...manualEntries]; // Add other entries as needed
      setEntries(allEntries);
    } catch (err) {
      console.error('Error fetching optimized calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchData();
  };

  const refetch = () => {
    fetchData();
  };

  return {
    events,
    tasks,
    reminders,
    entries,
    manualEntries,
    maw3dEvents,
    loading,
    error,
    refresh,
    refetch,
    setManualEntries,
  };
}
