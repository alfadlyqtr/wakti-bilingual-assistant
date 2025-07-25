
import { useState, useEffect } from 'react';
import { TRService, TRTask, TRReminder } from '@/services/trService';

export const useTRData = () => {
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    console.log('useTRData: Starting data fetch');
    setLoading(true);
    setError(null);
    
    try {
      const [tasksData, remindersData] = await Promise.all([
        TRService.getTasks(),
        TRService.getReminders()
      ]);
      
      console.log('useTRData: Data fetched successfully:', {
        tasksCount: tasksData.length,
        remindersCount: remindersData.length
      });
      
      setTasks(tasksData);
      setReminders(remindersData);
    } catch (error) {
      console.error('useTRData: Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      setTasks([]);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { 
    tasks, 
    reminders, 
    loading, 
    error, 
    refresh: fetchData 
  };
};
