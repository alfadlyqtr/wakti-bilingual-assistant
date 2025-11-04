// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Maw3dEvent } from '@/types/maw3d';

export function useOptimizedMaw3dEvents() {
  const [events, setEvents] = useState<Maw3dEvent[]>([]);
  const [attendingCounts, setAttendingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEventsAndCounts = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      // Fetch ONLY the current user's events - explicit filtering for security
      const { data: eventsData, error: eventsError } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('created_by', userData.user.id)  // Explicit user filtering
        .order('event_date', { ascending: true });

      if (eventsError) throw eventsError;

      setEvents(eventsData || []);

      // Fetch RSVP counts for user's events only - FIXED: Count only 'accepted' responses
      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(event => event.id);
        
        const { data: rsvpData, error: rsvpError } = await supabase
          .from('maw3d_rsvps')
          .select('event_id, response')
          .in('event_id', eventIds)
          .eq('response', 'accepted'); // Only count accepted RSVPs

        if (rsvpError) throw rsvpError;

        // Count RSVPs by event - simplified since we already filtered for 'accepted'
        const counts: Record<string, number> = {};
        if (rsvpData) {
          rsvpData.forEach(rsvp => {
            counts[rsvp.event_id] = (counts[rsvp.event_id] || 0) + 1;
          });
        }
        
        console.log('📊 Attending counts calculated:', counts);
        setAttendingCounts(counts);
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching Maw3d events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventsAndCounts();

    // Set up real-time subscriptions for user's events only
    const eventsChannel = supabase
      .channel('maw3d-events-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'maw3d_events'
      }, (payload) => {
        console.log('Maw3d events changed, refetching...');
        fetchEventsAndCounts();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'maw3d_rsvps' 
      }, (payload) => {
        console.log('Maw3d RSVPs changed, refetching...');
        fetchEventsAndCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
    };
  }, []);

  return {
    events,
    attendingCounts,
    loading,
    error,
    refetch: fetchEventsAndCounts
  };
}
