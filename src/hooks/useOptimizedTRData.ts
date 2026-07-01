
import { useState, useEffect, useCallback, useRef } from 'react';
import { TRService, TRTask, TRReminder } from '@/services/trService';
import { supabase } from '@/integrations/supabase/client';
import { useDebounced } from './useDebounced';

// Simple cache to prevent duplicate requests
let dataCache: {
  tasks: TRTask[];
  reminders: TRReminder[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 10000; // 10 seconds

export const useOptimizedTRData = () => {
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const rtDebounceRef = useRef<number | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current && !force) {
      return;
    }

    // Check cache first
    const now = Date.now();
    if (!force && dataCache && (now - dataCache.timestamp) < CACHE_TTL) {
      setTasks(dataCache.tasks);
      setReminders(dataCache.reminders);
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const [tasksData, remindersData] = await Promise.all([
        TRService.getTasks(),
        TRService.getReminders()
      ]);
      
      if (!mountedRef.current) return;

      // Update cache
      dataCache = {
        tasks: tasksData,
        reminders: remindersData,
        timestamp: now
      };

      setTasks(tasksData);
      setReminders(remindersData);
      
    } catch (error) {
      console.error('❌ Error fetching TR data:', error);
      if (mountedRef.current) {
        setError(error instanceof Error ? error.message : 'Failed to load data');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, []);

  // Debounced refresh to prevent excessive calls
  const debouncedRefresh = useDebounced(fetchData, 500);

  const refreshData = useCallback(() => {
    // Clear cache to force fresh fetch
    dataCache = null;
    return fetchData(true);
  }, [fetchData]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    
    return () => {
      mountedRef.current = false;
    };
  }, []); // Empty dependencies - only run once on mount

  // Realtime: keep tasks/reminders fresh across tabs/devices
  useEffect(() => {
    let remindersChannel: ReturnType<typeof supabase.channel> | null = null;
    let tasksChannel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefetch = () => {
      if (rtDebounceRef.current) window.clearTimeout(rtDebounceRef.current);
      rtDebounceRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          dataCache = null;
          fetchData(true);
        }
      }, 200);
    };

    try {
      remindersChannel = supabase
        .channel('rt-optimized-tr_reminders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_reminders' }, () => scheduleRefetch())
        .subscribe();

      tasksChannel = supabase
        .channel('rt-optimized-tr_tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_tasks' }, () => scheduleRefetch())
        .subscribe();
    } catch (e) {
      console.warn('useOptimizedTRData: Failed to attach realtime channels', e);
    }

    return () => {
      if (rtDebounceRef.current) window.clearTimeout(rtDebounceRef.current);
      remindersChannel?.unsubscribe();
      tasksChannel?.unsubscribe();
    };
  }, [fetchData]);

  return { 
    tasks, 
    reminders, 
    loading, 
    error, 
    refresh: refreshData,
    debouncedRefresh
  };
};
