
import { useState, useEffect, useCallback, useRef } from 'react';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent } from '@/types/maw3d';
import { PerformanceCache } from '@/services/PerformanceCache';

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current && !forceRefresh) {
      console.log('🔄 Request already in progress, skipping...');
      return;
    }

    // Rate limiting: don't fetch more than once every 30 seconds unless forced
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchRef.current) < 30000) {
      console.log('🔄 Rate limited, using cached data');
      return;
    }

    try {
      const cacheKey = 'maw3d_events';
      
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cached = PerformanceCache.get<Maw3dEvent[]>(cacheKey);
        if (cached && cached.length >= 0) {
          console.log('🎯 Using cached Maw3d events:', cached.length);
          setEvents(cached);
          setLoading(false);
          return;
        }
      }

      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      lastFetchRef.current = now;

      console.log('🔄 Fetching Maw3d events from API');
      const userEvents = await Maw3dService.getUserEvents();
      
      // Cache for 10 minutes (extended from 5 minutes)
      PerformanceCache.set(cacheKey, userEvents, 600000);
      setEvents(userEvents);
      
      console.log('✅ Maw3d events fetched successfully:', userEvents.length);
      
    } catch (err) {
      console.error('❌ Error fetching Maw3d events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  const invalidateCache = useCallback(() => {
    PerformanceCache.invalidate('maw3d_events');
    lastFetchRef.current = 0;
  }, []);

  const refreshEvents = useCallback(() => {
    console.log('🔄 Force refreshing Maw3d events');
    return fetchEvents(true);
  }, [fetchEvents]);

  // Single effect for initial load
  useEffect(() => {
    fetchEvents();
  }, []); // Empty dependency array - only run once

  // Remove auto-refresh on focus to prevent excessive calls
  // Users can manually refresh using pull-to-refresh

  return {
    events,
    loading,
    error,
    refreshEvents,
    invalidateCache
  };
}
