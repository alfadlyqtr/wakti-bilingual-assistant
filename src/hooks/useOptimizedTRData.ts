
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService } from '@/services/trService';

export function useOptimizedTRData() {
  const { user } = useAuth();
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
      const tasksData = await TRService.getTasks(user.id);
      const remindersData = await TRService.getReminders(user.id);

      setTasks(tasksData);
      setReminders(remindersData);
    } catch (err) {
      console.error('Error fetching optimized TR data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchData();
  };

  return {
    tasks,
    reminders,
    loading,
    error,
    refetch,
  };
}
