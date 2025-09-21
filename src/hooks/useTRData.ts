
import { useState, useEffect, useRef } from 'react';
import { TRService, TRTask, TRReminder } from '@/services/trService';
import { supabase } from '@/integrations/supabase/client';

export const useTRData = () => {
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const unsubscribed = useRef(false);

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

  // Realtime: keep tasks/reminders fresh across tabs/devices
  useEffect(() => {
    let taskChannel: ReturnType<typeof supabase.channel> | null = null;
    let subtaskChannel: ReturnType<typeof supabase.channel> | null = null;
    let sharedRespChannel: ReturnType<typeof supabase.channel> | null = null;

    const attach = async () => {
      try {
        // Optionally scope tr_tasks by current user for less noise
        const { data: user } = await supabase.auth.getUser();
        const uid = user.user?.id;

        taskChannel = supabase
          .channel('rt-tr_tasks')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_tasks', ...(uid ? { filter: `user_id=eq.${uid}` } : {}) }, () => scheduleRefetch())
          .subscribe();

        // Subtasks impact task counters/expansion UIs; listen broadly
        subtaskChannel = supabase
          .channel('rt-tr_subtasks')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_subtasks' }, () => scheduleRefetch())
          .subscribe();

        // Shared responses (completions/comments/requests) can affect Activity view and sometimes task status
        sharedRespChannel = supabase
          .channel('rt-tr_shared_responses')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_shared_responses' }, () => scheduleRefetch())
          .subscribe();
      } catch (e) {
        // Non-fatal: we still have manual refresh
        console.warn('useTRData: Failed to attach realtime channels', e);
      }
    };

    const scheduleRefetch = () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      // Debounce rapid bursts to a single fetch
      debounceTimer.current = window.setTimeout(() => {
        if (!unsubscribed.current) fetchData();
      }, 200);
    };

    attach();

    return () => {
      unsubscribed.current = true;
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      taskChannel?.unsubscribe();
      subtaskChannel?.unsubscribe();
      sharedRespChannel?.unsubscribe();
    };
  }, []);

  return { 
    tasks, 
    reminders, 
    loading, 
    error, 
    refresh: fetchData 
  };
};
