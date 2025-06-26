
import { useState, useEffect, useCallback, useRef } from 'react';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent } from '@/types/maw3d';

// Simple in-memory cache with TTL
const CACHE_TTL = 30000; // 30 seconds
let eventsCache: {
  data: Maw3dEvent[] | null;
  timestamp: number;
  loading: boolean;
} = {
  data: null,
  timestamp: 0,
  loading: false
};

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (fetchingRef.current) {
      console.log('🔄 Request already in progress, skipping...');
      return;
    }

    // Check cache first
    const now = Date.now();
    const cacheValid = eventsCache.data && (now - eventsCache.timestamp) < CACHE_TTL;
    
    if (cacheValid && eventsCache.data) {
      console.log('⚡ Using cached events:', eventsCache.data.length);
      setEvents(eventsCache.data);
      setLoading(false);
      setError(null);
      return;
    }

    if (eventsCache.loading) {
      console.log('🔄 Another instance is loading, waiting...');
      return;
    }

    try {
      fetchingRef.current = true;
      eventsCache.loading = true;
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching fresh Maw3d events from API');
      const userEvents = await Maw3dService.getUserEvents();
      
      if (!mountedRef.current) return;

      // Update cache
      eventsCache = {
        data: userEvents,
        timestamp: now,
        loading: false
      };

      setEvents(userEvents);
      console.log('✅ Maw3d events fetched and cached:', userEvents.length);
      
    } catch (err) {
      console.error('❌ Error fetching Maw3d events:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
        setEvents([]);
      }
      eventsCache.loading = false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
      eventsCache.loading = false;
    }
  }, []); // Empty dependencies to prevent infinite loops

  const refreshEvents = useCallback(() => {
    console.log('🔄 Force refreshing Maw3d events');
    // Clear cache to force fresh fetch
    eventsCache = { data: null, timestamp: 0, loading: false };
    return fetchEvents();
  }, [fetchEvents]);

  // Single effect for initial load only
  useEffect(() => {
    mountedRef.current = true;
    fetchEvents();
    
    return () => {
      mountedRef.current = false;
    };
  }, []); // Empty dependencies - only run once on mount

  return {
    events,
    loading,
    error,
    refreshEvents
  };
}
