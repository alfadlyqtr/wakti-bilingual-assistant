
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';
import { useDebounced } from '@/hooks/useDebounced';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [sharedTaskCount, setSharedTaskCount] = useState(0);
  const [perContactUnread, setPerContactUnread] = useState<Record<string, number>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Debounced fetch function to prevent rapid requests
  const debouncedFetchUnreadCounts = useDebounced(fetchUnreadCounts, 1000);

  useEffect(() => {
    if (!user) {
      resetCounts();
      return;
    }

    console.log('👀 Setting up unread message tracking for user:', user.id);

    // Add a delay before initializing to prevent immediate token refresh
    const initTimeout = setTimeout(() => {
      initializeUnreadCounts();
      setIsInitialized(true);
    }, 2000); // 2 second delay after login

    return () => {
      clearTimeout(initTimeout);
      cleanupSubscriptions();
    };
  }, [user]);

  const resetCounts = () => {
    setUnreadTotal(0);
    setContactCount(0);
    setMaw3dEventCount(0);
    setTaskCount(0);
    setSharedTaskCount(0);
    setPerContactUnread({});
    setIsInitialized(false);
  };

  const initializeUnreadCounts = async () => {
    if (!user?.id) return;

    try {
      // Use sequential loading instead of batched loading
      await sequentialLoadUnreadCounts();
      setupRealtimeSubscriptions();
    } catch (error) {
      console.error('❌ Error initializing unread counts:', error);
      // If rate limited, retry with exponential backoff
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        setTimeout(() => {
          console.log('🔄 Retrying unread counts initialization after rate limit');
          initializeUnreadCounts();
        }, 5000);
      }
    }
  };

  // SEQUENTIAL API CALLS - Converts 5 simultaneous calls to sequential calls
  const sequentialLoadUnreadCounts = async () => {
    if (!user?.id) return;

    console.log('📊 Starting sequential loading of unread counts');

    try {
      // Load counts one by one to prevent auth request stampede
      console.log('🔄 Loading messages count...');
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      console.log('🔄 Loading per-contact breakdown...');
      const { data: perContactData } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      console.log('🔄 Loading contact requests...');
      const { count: contactRequestCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      console.log('🔄 Loading event RSVPs...');
      const { count: eventRsvpCount } = await supabase
        .from('maw3d_rsvps')
        .select(`
          *,
          maw3d_events!inner(created_by)
        `, { count: 'exact', head: true })
        .eq('maw3d_events.created_by', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      console.log('🔄 Loading shared task responses...');
      const { count: sharedTaskResponseCount } = await supabase
        .from('tr_shared_responses')
        .select(`
          *,
          tr_tasks!inner(user_id)
        `, { count: 'exact', head: true })
        .eq('tr_tasks.user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Process per-contact unread counts
      const perContactCounts: Record<string, number> = {};
      perContactData?.forEach(msg => {
        perContactCounts[msg.sender_id] = (perContactCounts[msg.sender_id] || 0) + 1;
      });

      // Update all states at once
      setUnreadTotal(messageCount || 0);
      setPerContactUnread(perContactCounts);
      setContactCount(contactRequestCount || 0);
      setMaw3dEventCount(eventRsvpCount || 0);
      setSharedTaskCount(sharedTaskResponseCount || 0);
      setTaskCount(0);

      console.log('✅ Sequential unread counts loaded:', {
        messages: messageCount,
        contacts: contactRequestCount,
        events: eventRsvpCount,
        tasks: sharedTaskResponseCount
      });

    } catch (error) {
      console.error('❌ Error in sequential loading:', error);
      throw error;
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!user?.id || !isInitialized) return;

    console.log('🔄 Setting up real-time subscriptions');

    // Messages subscription
    const messagesChannel = supabase
      .channel('unread-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, async (payload) => {
        console.log('📨 New message received:', payload);
        
        await waktiToast.show({
          id: `message-${payload.new.id}`,
          type: 'message',
          title: 'New Message',
          message: 'You have received a new message',
          priority: 'normal',
          sound: 'chime'
        });
        
        debouncedFetchUnreadCounts();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, () => {
        debouncedFetchUnreadCounts();
      })
      .subscribe();

    const contactsChannel = supabase
      .channel('contact-requests')
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
        
        debouncedFetchUnreadCounts();
      })
      .subscribe();

    const maw3dChannel = supabase
      .channel('maw3d-rsvps')
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
          
          debouncedFetchUnreadCounts();
        }
      })
      .subscribe();

    const sharedTaskChannel = supabase
      .channel('shared-task-responses')
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
          
          debouncedFetchUnreadCounts();
        }
      })
      .subscribe();

    // Store channels for cleanup
    window.unreadChannels = [messagesChannel, contactsChannel, maw3dChannel, sharedTaskChannel];
  };

  const cleanupSubscriptions = () => {
    console.log('🧹 Cleaning up unread message subscriptions');
    if (window.unreadChannels) {
      window.unreadChannels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      window.unreadChannels = [];
    }
  };

  async function fetchUnreadCounts() {
    if (!user?.id || !isInitialized) return;

    try {
      console.log('📊 Fetching unread counts for user:', user.id);
      await sequentialLoadUnreadCounts();
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error);
      // Handle rate limiting gracefully
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('⚠️ Rate limited, will retry later');
        return;
      }
    }
  }

  return {
    unreadTotal,
    contactCount,
    maw3dEventCount,
    taskCount,
    sharedTaskCount,
    perContactUnread,
    refetch: debouncedFetchUnreadCounts
  };
}
