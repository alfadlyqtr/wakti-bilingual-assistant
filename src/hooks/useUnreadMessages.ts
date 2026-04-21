import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';

// FEATURE FLAG: Set to true to re-enable real-time subscriptions
// Currently disabled to test if WebSocket blocking in appetize.io causes crash
const ENABLE_REALTIME_SUBSCRIPTIONS = true;

// Global deduplication to prevent multiple concurrent instances
let globalSetupInProgress = false;
let globalUserId: string | null = null;
let globalCleanupFn: (() => void) | null = null;
let globalSubscriberCount = 0;
let globalFetchTimeout: NodeJS.Timeout | null = null;
let globalFetchInFlight: Promise<void> | null = null;
let globalLastCountsSnapshot = "";

type UnreadMessagesState = {
  unreadTotal: number;
  contactCount: number;
  maw3dEventCount: number;
  taskCount: number;
  sharedTaskCount: number;
  perContactUnread: Record<string, number>;
};

const EMPTY_UNREAD_STATE: UnreadMessagesState = {
  unreadTotal: 0,
  contactCount: 0,
  maw3dEventCount: 0,
  taskCount: 0,
  sharedTaskCount: 0,
  perContactUnread: {}
};

let globalUnreadState: UnreadMessagesState = EMPTY_UNREAD_STATE;
const globalListeners = new Set<(state: UnreadMessagesState) => void>();

const broadcastUnreadState = () => {
  globalListeners.forEach((listener) => listener(globalUnreadState));
};

const resetGlobalUnreadState = () => {
  globalUnreadState = EMPTY_UNREAD_STATE;
  globalLastCountsSnapshot = "";
  broadcastUnreadState();
};

const fetchGlobalUnreadCounts = async (userId: string, DEV: boolean) => {
  if (globalFetchInFlight) {
    return globalFetchInFlight;
  }

  globalFetchInFlight = (async () => {
    try {
      if (DEV) console.log('📊 Fetching unread counts for user:', userId);

      const [
        { count: messageCount },
        { data: perContactData, error: perContactError },
        { count: contactRequestCount },
        { count: eventRsvpCount },
        { count: sharedTaskResponseCount }
      ] = await Promise.all([
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .eq('is_read', false),

        supabase
          .from('messages')
          .select('sender_id')
          .eq('recipient_id', userId)
          .eq('is_read', false),

        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('contact_id', userId)
          .eq('status', 'pending'),

        supabase
          .from('maw3d_rsvps')
          .select(`
            *,
            maw3d_events!inner(created_by)
          `, { count: 'exact', head: true })
          .eq('maw3d_events.created_by', userId)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

        supabase
          .from('tr_shared_responses')
          .select(`
            *,
            tr_tasks!inner(user_id)
          `, { count: 'exact', head: true })
          .eq('tr_tasks.user_id', userId)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (perContactError) {
        console.error('❌ Error fetching per-contact unread:', perContactError);
      }

      const perContactCounts: Record<string, number> = {};
      perContactData?.forEach(msg => {
        perContactCounts[msg.sender_id] = (perContactCounts[msg.sender_id] || 0) + 1;
      });

      globalUnreadState = {
        unreadTotal: messageCount || 0,
        contactCount: contactRequestCount || 0,
        maw3dEventCount: eventRsvpCount || 0,
        taskCount: 0,
        sharedTaskCount: sharedTaskResponseCount || 0,
        perContactUnread: perContactCounts
      };

      broadcastUnreadState();

      if (DEV) {
        const snapshot = JSON.stringify({
          messages: messageCount,
          contacts: contactRequestCount,
          events: eventRsvpCount,
          sharedTasks: sharedTaskResponseCount
        });
        if (snapshot !== globalLastCountsSnapshot) {
          globalLastCountsSnapshot = snapshot;
          console.log('📊 Final unread counts updated:', {
            messages: messageCount,
            contacts: contactRequestCount,
            events: eventRsvpCount,
            sharedTasks: sharedTaskResponseCount,
            perContact: perContactCounts
          });
        }
      }
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error);
    } finally {
      globalFetchInFlight = null;
    }
  })();

  return globalFetchInFlight;
};

const scheduleGlobalUnreadFetch = (userId: string, DEV: boolean, immediate = false) => {
  if (globalFetchTimeout) clearTimeout(globalFetchTimeout);

  if (immediate) {
    void fetchGlobalUnreadCounts(userId, DEV);
    return;
  }

  globalFetchTimeout = setTimeout(() => {
    void fetchGlobalUnreadCounts(userId, DEV);
  }, 1000);
};

export function useUnreadMessages() {
  const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);
  const { user } = useAuth();
  const [state, setState] = useState<UnreadMessagesState>(globalUnreadState);

  useEffect(() => {
    globalListeners.add(setState);
    setState(globalUnreadState);

    return () => {
      globalListeners.delete(setState);
    };
  }, []);

  const fetchUnreadCounts = useCallback(() => {
    if (!user?.id) return;
    scheduleGlobalUnreadFetch(user.id, DEV);
  }, [DEV, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      if (!globalUserId) {
        resetGlobalUnreadState();
      }
      return;
    }

    if (globalUserId && globalUserId !== user.id && globalCleanupFn) {
      globalCleanupFn();
    }

    globalUserId = user.id;
    globalSubscriberCount += 1;

    // If real-time subscriptions are disabled, just fetch initial counts
    if (!ENABLE_REALTIME_SUBSCRIPTIONS) {
      if (DEV) console.log('⚠️ Real-time subscriptions disabled - fetching initial counts only');
      scheduleGlobalUnreadFetch(user.id, DEV, true);
      return () => {
        globalSubscriberCount = Math.max(0, globalSubscriberCount - 1);
        if (globalSubscriberCount === 0) {
          resetGlobalUnreadState();
          globalUserId = null;
        }
      };
    }

    // Global deduplication - only allow one instance per user
    if (globalSetupInProgress || globalCleanupFn) {
      return () => {
        globalSubscriberCount = Math.max(0, globalSubscriberCount - 1);
        if (globalSubscriberCount === 0 && globalCleanupFn) {
          globalCleanupFn();
        }
      };
    }

    globalSetupInProgress = true;

    let messagesChannel: any;
    let contactsChannel: any;
    let maw3dChannel: any;
    let sharedTaskChannel: any;

    const setup = async () => {
      try {
        // Get initial counts
        await fetchGlobalUnreadCounts(user.id, DEV);

        // Set up real-time subscriptions with individual error handling
        // Each subscription is wrapped to prevent app crash if WebSocket fails (iOS WebView)
        // StrictMode guard: remove existing channels before creating new ones
        const channelNames = [
          `unread-messages:${user.id}`,
          `contact-requests:${user.id}`,
          `maw3d-rsvps:${user.id}`,
          `shared-task-responses:${user.id}`
        ];
        channelNames.forEach(name => {
          const existing = supabase.getChannels().find(c => c.topic === `realtime:${name}`);
          if (existing) supabase.removeChannel(existing);
        });

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
              
              scheduleGlobalUnreadFetch(user.id, DEV);
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `recipient_id=eq.${user.id}`
            }, () => {
              scheduleGlobalUnreadFetch(user.id, DEV);
            })
            .subscribe();
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
              
              scheduleGlobalUnreadFetch(user.id, DEV);
            })
            .subscribe();
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
                
                scheduleGlobalUnreadFetch(user.id, DEV);
              }
            })
            .subscribe();
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
                
                scheduleGlobalUnreadFetch(user.id, DEV);
              }
            })
            .subscribe();
        } catch (e) {
          console.warn('⚠️ Failed to subscribe to shared task channel (non-fatal):', e);
        }
      } catch (error) {
        console.error('❌ Error setting up unread message tracking:', error);
      }
    };

    const cleanup = () => {
      if (globalFetchTimeout) clearTimeout(globalFetchTimeout);
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (contactsChannel) supabase.removeChannel(contactsChannel);
      if (maw3dChannel) supabase.removeChannel(maw3dChannel);
      if (sharedTaskChannel) supabase.removeChannel(sharedTaskChannel);
      
      // Reset global state
      globalSetupInProgress = false;
      globalUserId = null;
      globalCleanupFn = null;
      resetGlobalUnreadState();
    };

    globalCleanupFn = cleanup;

    void setup().finally(() => {
      globalSetupInProgress = false;
    });

    return () => {
      globalSubscriberCount = Math.max(0, globalSubscriberCount - 1);
      if (globalSubscriberCount === 0 && globalCleanupFn) {
        globalCleanupFn();
      }
    };
  }, [DEV, user?.id]);

  return {
    unreadTotal: state.unreadTotal,
    contactCount: state.contactCount,
    maw3dEventCount: state.maw3dEventCount,
    taskCount: state.taskCount,
    sharedTaskCount: state.sharedTaskCount,
    perContactUnread: state.perContactUnread,
    refetch: fetchUnreadCounts
  };
}
