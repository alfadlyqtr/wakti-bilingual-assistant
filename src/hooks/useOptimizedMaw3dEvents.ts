
import { useState, useEffect, useCallback } from 'react';
import { Maw3dService } from '@/services/maw3dService';
import { Maw3dEvent } from '@/types/maw3d';

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching Maw3d events from API');
      const userEvents = await Maw3dService.getUserEvents();
      
      setEvents(userEvents);
      console.log('✅ Maw3d events fetched successfully:', userEvents.length);
      
    } catch (err) {
      console.error('❌ Error fetching Maw3d events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEvents = useCallback(() => {
    console.log('🔄 Refreshing Maw3d events');
    return fetchEvents();
  }, [fetchEvents]);

  // Single effect for initial load
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refreshEvents
  };
}
