import { useState, useEffect, useRef } from 'react';
import { supabase, ensurePassport } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';

// FEATURE FLAG: Set to true to re-enable real-time subscriptions
// Currently disabled to test if WebSocket blocking in appetize.io causes crash
const ENABLE_REALTIME_SUBSCRIPTIONS = true;

// Global deduplication to prevent multiple concurrent instances
let globalSetupInProgress = false;
let globalUserId: string | null = null;
let globalCleanupFn: (() => void) | null = null;

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [sharedTaskCount, setSharedTaskCount] = useState(0);
  const [perContactUnread, setPerContactUnread] = useState<Record<string, number>>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    // If real-time subscriptions are disabled, just fetch initial counts
    if (!ENABLE_REALTIME_SUBSCRIPTIONS) {
      console.log('⚠️ Real-time subscriptions disabled - fetching initial counts only');
      const fetchInitial = async () => {
        try {
          await ensurePassport();
          await fetchUnreadCounts();
        } catch (e) {
          console.error('Error fetching initial counts:', e);
        }
      };
      fetchInitial();
      return () => {
        console.log('🧹 Cleanup (subscriptions disabled)');
      };
    }

    // Global deduplication - only allow one instance per user
    if (globalSetupInProgress || globalUserId === user.id) {
      console.log('⏭️ Unread subscriptions already running for user:', user.id);
      return;
    }

    globalSetupInProgress = true;
    globalUserId = user.id;

    let messagesChannel: any;
    let contactsChannel: any;
    let maw3dChannel: any;
    let sharedTaskChannel: any;

    const setup = async () => {
      try {
        await ensurePassport();

        console.log('👀 Setting up unread message tracking for user:', user.id);

        // Get initial counts
        await fetchUnreadCounts();

        // Set up real-time subscriptions with individual error handling
        // Each subscription is wrapped to prevent app crash if WebSocket fails (iOS WebView)
        try {
          messagesChannel = supabase
            .channel(`unread-messages:${user.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `recipient_id=eq.${user.id}`
            }, async (payload) => {
              console.log('📨 New message received:', payload);
              
              // Show notification
              await waktiToast.show({
                id: `message-${payload.new.id}`,
                type: 'message',
                title: 'New Message',
                message: 'You have received a new message',
                priority: 'normal',
                sound: 'chime'
              });
              
              fetchUnreadCounts();
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `recipient_id=eq.${user.id}`
            }, () => {
              fetchUnreadCounts();
            })
            .subscribe();
          console.log('✅ Messages channel subscribed');
        } catch (e) {
          console.warn('⚠️ Failed to subscribe to messages channel (non-fatal):', e);
        }

        try {
          contactsChannel = supabase
            .channel(`contact-requests:${user.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'contacts',
              filter: `contact_id=eq.${user.id}`
            }, async (payload) => {
              console.log('👥 New contact request:', payload);
              
              if (payload.new.status === 'pending') {
                await waktiToast.show({
                  id: `contact-${payload.new.id}`,
                  type: 'contact',
                  title: 'Contact Request',
                  message: 'Someone wants to connect with you',
                  priority: 'normal',
                  sound: 'ding'
                });
              }
              
              fetchUnreadCounts();
            })
            .subscribe();
          console.log('✅ Contacts channel subscribed');
        } catch (e) {
          console.warn('⚠️ Failed to subscribe to contacts channel (non-fatal):', e);
        }

        try {
          maw3dChannel = supabase
            .channel(`maw3d-rsvps:${user.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'maw3d_rsvps'
            }, async (payload) => {
              console.log('📅 New Maw3d RSVP:', payload);
              
              // Check if this is for user's event
              await ensurePassport();
              const { data: event } = await supabase
                .from('maw3d_events')
                .select('created_by, title')
                .eq('id', payload.new.event_id)
                .single();
                
              if (event?.created_by === user.id) {
                await waktiToast.show({
                  id: `rsvp-${payload.new.id}`,
                  type: 'event',
                  title: 'RSVP Response',
                  message: `${payload.new.guest_name} responded to ${event.title}`,
                  priority: 'normal',
                  sound: 'beep'
                });
                
                fetchUnreadCounts();
              }
            })
            .subscribe();
          console.log('✅ Maw3d channel subscribed');
        } catch (e) {
          console.warn('⚠️ Failed to subscribe to maw3d channel (non-fatal):', e);
        }

        try {
          sharedTaskChannel = supabase
            .channel(`shared-task-responses:${user.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'tr_shared_responses'
            }, async (payload) => {
              console.log('📋 New shared task response:', payload);
              
              // Check if this is for user's task
              await ensurePassport();
              const { data: task } = await supabase
                .from('tr_tasks')
                .select('user_id, title')
                .eq('id', payload.new.task_id)
                .single();
                
              if (task?.user_id === user.id) {
                let message = 'Task updated';
                if (payload.new.response_type === 'completion' && payload.new.is_completed) {
                  message = `${payload.new.visitor_name} completed: ${task.title}`;
                } else if (payload.new.response_type === 'comment') {
                  message = `${payload.new.visitor_name} commented on: ${task.title}`;
                }
                
                await waktiToast.show({
                  id: `task-${payload.new.id}`,
                  type: 'shared_task',
                  title: 'Task Update',
                  message,
                  priority: 'normal',
                  sound: 'chime'
                });
                
                fetchUnreadCounts();
              }
            })
            .subscribe();
          console.log('✅ Shared task channel subscribed');
        } catch (e) {
          console.warn('⚠️ Failed to subscribe to shared task channel (non-fatal):', e);
        }
      } catch (error) {
        console.error('❌ Error setting up unread message tracking:', error);
      }
    };

    setup();

    const cleanup = () => {
      console.log('🧹 Cleaning up unread message subscriptions');
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (contactsChannel) supabase.removeChannel(contactsChannel);
      if (maw3dChannel) supabase.removeChannel(maw3dChannel);
      if (sharedTaskChannel) supabase.removeChannel(sharedTaskChannel);
      
      // Reset global state
      globalSetupInProgress = false;
      globalUserId = null;
      globalCleanupFn = null;
      initializedRef.current = false;
    };

    globalCleanupFn = cleanup;

    return cleanup;
  }, [user?.id]);

  const fetchUnreadCounts = async () => {
    if (!user) return;

    try {
      await ensurePassport();
      console.log('📊 Fetching unread counts for user:', user.id);
      
      // Messages count
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      console.log('📨 Total unread messages:', messageCount);

      // Per-contact unread counts with detailed logging
      const { data: perContactData, error: perContactError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (perContactError) {
        console.error('❌ Error fetching per-contact unread:', perContactError);
      }

      console.log('📊 Per-contact unread data:', perContactData);

      const perContactCounts: Record<string, number> = {};
      perContactData?.forEach(msg => {
        perContactCounts[msg.sender_id] = (perContactCounts[msg.sender_id] || 0) + 1;
      });

      console.log('📊 Per-contact unread counts:', perContactCounts);

      // Contact requests count
      const { count: contactRequestCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      // Maw3d event RSVPs count (events user created)
      const { count: eventRsvpCount } = await supabase
        .from('maw3d_rsvps')
        .select(`
          *,
          maw3d_events!inner(created_by)
        `, { count: 'exact', head: true })
        .eq('maw3d_events.created_by', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Shared task responses count
      const { count: sharedTaskResponseCount } = await supabase
        .from('tr_shared_responses')
        .select(`
          *,
          tr_tasks!inner(user_id)
        `, { count: 'exact', head: true })
        .eq('tr_tasks.user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setUnreadTotal(messageCount || 0);
      setContactCount(contactRequestCount || 0);
      setMaw3dEventCount(eventRsvpCount || 0);
      setSharedTaskCount(sharedTaskResponseCount || 0);
      setTaskCount(0); // Regular task count if needed
      setPerContactUnread(perContactCounts);

      console.log('📊 Final unread counts updated:', {
        messages: messageCount,
        contacts: contactRequestCount,
        events: eventRsvpCount,
        sharedTasks: sharedTaskResponseCount,
        perContact: perContactCounts
      });

    } catch (error) {
      console.error('❌ Error fetching unread counts:', error);
    }
  };

  return {
    unreadTotal,
    contactCount,
    maw3dEventCount,
    taskCount,
    sharedTaskCount,
    perContactUnread,
    refetch: fetchUnreadCounts
  };
}
