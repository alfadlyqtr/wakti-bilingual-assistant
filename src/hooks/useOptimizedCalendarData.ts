
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { trService } from '@/services/trService';

export function useOptimizedCalendarData() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
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
      const tasksData = await trService.getTasks(user.id);
      const remindersData = await trService.getReminders(user.id);

      setTasks(tasksData);
      setReminders(remindersData);
      setEvents([]); // Events will be loaded separately
    } catch (err) {
      console.error('Error fetching optimized calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchData();
  };

  return {
    events,
    tasks,
    reminders,
    loading,
    error,
    refetch,
  };
}
