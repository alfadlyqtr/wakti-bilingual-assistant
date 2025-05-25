
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

export function useRsvpNotifications() {
  const { user } = useAuth();
  const { language } = useTheme();

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up RSVP notifications for user:', user.id);

    // Subscribe to new RSVP responses for events created by the current user
    const channel = supabase
      .channel('rsvp-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_rsvps',
          filter: `user_id=neq.${user.id}` // Don't notify for own RSVPs
        },
        async (payload) => {
          console.log('New RSVP received:', payload);
          
          const newRsvp = payload.new;
          
          // Check if this RSVP is for an event created by the current user
          const { data: event, error } = await supabase
            .from('events')
            .select('id, title, created_by')
            .eq('id', newRsvp.event_id)
            .eq('created_by', user.id)
            .single();
          
          if (error) {
            console.error('Error fetching event for RSVP notification:', error);
            return;
          }
          
          if (!event) {
            console.log('RSVP is not for an event created by current user');
            return;
          }
          
          // Get the responder's name
          let responderName = newRsvp.guest_name || 'Someone';
          
          if (newRsvp.user_id) {
            // Try to get the user's display name from profiles
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', newRsvp.user_id)
              .single();
            
            if (profile) {
              responderName = profile.display_name || profile.username || 'WAKTI User';
            }
          }
          
          // Show notification toast
          const isAccepted = newRsvp.response === 'accepted';
          const message = isAccepted 
            ? t('rsvpNotificationAccepted', language).replace('{name}', responderName)
            : t('rsvpNotificationDeclined', language).replace('{name}', responderName);
          
          toast(message, {
            description: event.title,
            duration: 5000,
            action: {
              label: 'View Event',
              onClick: () => {
                window.location.href = `/event/${event.id}`;
              },
            },
          });
          
          console.log(`RSVP notification shown: ${responderName} ${newRsvp.response} ${event.title}`);
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up RSVP notifications');
      supabase.removeChannel(channel);
    };
  }, [user?.id, language]);
}
