
import { useState, useEffect, useCallback, useRef } from 'react';
import { TRService, TRTask, TRReminder } from '@/services/trService';
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

  const fetchData = useCallback(async (force = false) => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current && !force) {
      console.log('🔄 Request already in progress, skipping...');
      return;
    }

    // Check cache first
    const now = Date.now();
    if (!force && dataCache && (now - dataCache.timestamp) < CACHE_TTL) {
      console.log('⚡ Using cached TR data');
      setTasks(dataCache.tasks);
      setReminders(dataCache.reminders);
      setLoading(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching fresh TR data from API');
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
      console.log('✅ TR data fetched and cached:', {
        tasksCount: tasksData.length,
        remindersCount: remindersData.length
      });
      
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
    console.log('🔄 Force refreshing TR data');
    // Clear cache to force fresh fetch
    dataCache = null;
    return fetchData(true);
  }, [fetchData]);

  // Single effect for initial load only
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    
    return () => {
      mountedRef.current = false;
    };
  }, []); // Empty dependencies - only run once on mount

  return { 
    tasks, 
    reminders, 
    loading, 
    error, 
    refresh: refreshData,
    debouncedRefresh
  };
};
