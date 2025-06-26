
import { useState, useEffect, useCallback } from 'react';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent } from '@/types/maw3d';
import { PerformanceCache } from '@/services/PerformanceCache';

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = 'maw3d_events';
      
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cached = PerformanceCache.get<Maw3dEvent[]>(cacheKey);
        if (cached) {
          setEvents(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      console.log('🔄 Fetching Maw3d events from API');
      const userEvents = await Maw3dService.getUserEvents();
      
      // Cache for 5 minutes
      PerformanceCache.set(cacheKey, userEvents, 300000);
      setEvents(userEvents);
      
    } catch (err) {
      console.error('Error fetching Maw3d events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateCache = useCallback(() => {
    PerformanceCache.invalidate('maw3d_events');
  }, []);

  const refreshEvents = useCallback(() => {
    return fetchEvents(true);
  }, [fetchEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh on focus (but use cache)
  useEffect(() => {
    const handleFocus = () => fetchEvents(false);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refreshEvents,
    invalidateCache
  };
}
