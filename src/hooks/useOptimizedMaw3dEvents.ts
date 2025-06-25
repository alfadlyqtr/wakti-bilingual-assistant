
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { performanceCache } from '@/services/PerformanceCache';

interface Maw3dEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  background_type: string;
  background_value: string;
  created_at: string;
  short_id?: string;
}

const CACHE_KEY = 'maw3d_events';
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (useCache = true) => {
    try {
      // Check cache first
      if (useCache) {
        const cachedEvents = performanceCache.get<Maw3dEvent[]>(CACHE_KEY);
        if (cachedEvents) {
          setEvents(cachedEvents);
          setIsLoading(false);
          return cachedEvents;
        }
      }

      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return [];
      }

      // Optimized query - only fetch necessary fields
      const { data, error: fetchError } = await supabase
        .from('maw3d_events')
        .select(`
          id,
          title,
          description,
          event_date,
          start_time,
          end_time,
          is_all_day,
          location,
          background_type,
          background_value,
          created_at,
          short_id
        `)
        .eq('created_by', user.id)
        .order('event_date', { ascending: true })
        .limit(50); // Limit to prevent large data loads

      if (fetchError) throw fetchError;

      const eventsData = data || [];
      
      // Cache the results
      performanceCache.set(CACHE_KEY, eventsData, CACHE_TTL);
      
      setEvents(eventsData);
      setIsLoading(false);
      return eventsData;

    } catch (err: any) {
      console.error('Error fetching Maw3d events:', err);
      setError(err.message || 'Failed to fetch events');
      setIsLoading(false);
      return [];
    }
  }, []);

  const invalidateCache = useCallback(() => {
    performanceCache.clear(CACHE_KEY);
  }, []);

  const refreshEvents = useCallback(() => {
    return fetchEvents(false);
  }, [fetchEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refreshEvents,
    invalidateCache
  };
}
