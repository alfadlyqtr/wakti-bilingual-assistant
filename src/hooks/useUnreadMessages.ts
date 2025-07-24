import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';
import { useDebounced } from '@/hooks/useDebounced';

export function useUnreadMessages() {
  const { user, isLoading: authLoading } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [sharedTaskCount, setSharedTaskCount] = useState(0);
  const [perContactUnread, setPerContactUnread] = useState<Record<string, number>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Debounced fetch function with longer delay
  const debouncedFetchUnreadCounts = useDebounced(fetchUnreadCounts, 2000);

  useEffect(() => {
    // Early return if not ready - prevents hook from running when it shouldn't
    if (authLoading || !user || isRateLimited) {
      if (!user) {
        resetCounts();
      }
      return;
    }

    console.log('👀 Setting up unread message tracking for user:', user.id);

    // Much longer delay before initializing to prevent rapid requests
    const initTimeout = setTimeout(() => {
      console.log('🚀 Starting delayed initialization of unread counts');
      initializeUnreadCounts();
    }, 5000); // Increased to 5 seconds

    return () => {
      clearTimeout(initTimeout);
      cleanupSubscriptions();
    };
  }, [user, authLoading, isRateLimited]);

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
    if (!user || authLoading || isRateLimited) {
      console.log('⚠️ Skipping initialization - not ready');
      return;
    }

    try {
      console.log('📊 Starting progressive loading with extended delays');
      await progressivelyLoadCounts();
      
      // Only set up subscriptions after successful loading
      setTimeout(() => {
        setupRealtimeSubscriptions();
        setIsInitialized(true);
      }, 2000);
    } catch (error) {
      console.error('❌ Error initializing unread counts:', error);
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('🔄 Rate limited, backing off');
        setIsRateLimited(true);
        
        // Exponential backoff - wait longer before retrying
        setTimeout(() => {
          setIsRateLimited(false);
          console.log('🔄 Retrying after rate limit backoff');
        }, 30000); // Wait 30 seconds before retrying
      }
    }
  };

  const progressivelyLoadCounts = async () => {
    if (!user || authLoading || isRateLimited) return;

    console.log('📊 Starting progressive loading with extended delays');

    try {
      // Load with much longer delays between requests
      await loadMessagesCount();
      await delay(2000); // 2 second delay

      await loadContactsCount();
      await delay(2000); // 2 second delay

      await loadEventsCount();
      await delay(2000); // 2 second delay

      await loadTasksCount();
      console.log('✅ All counts loaded successfully');
    } catch (error) {
      console.error('❌ Error in progressive loading:', error);
      throw error;
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const loadMessagesCount = async () => {
    if (!user || isRateLimited) return;
    
    try {
      console.log('📨 Loading messages count...');
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      const { data: perContactData } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      const perContactCounts: Record<string, number> = {};
      perContactData?.forEach(msg => {
        perContactCounts[msg.sender_id] = (perContactCounts[msg.sender_id] || 0) + 1;
      });

      setUnreadTotal(messageCount || 0);
      setPerContactUnread(perContactCounts);
      console.log('✅ Messages loaded:', messageCount);
    } catch (error) {
      console.error('❌ Error loading messages count:', error);
      if (error.message?.includes('429')) {
        throw error; // Re-throw to trigger rate limiting
      }
    }
  };

  const loadContactsCount = async () => {
    if (!user || isRateLimited) return;
    
    try {
      console.log('👥 Loading contacts count...');
      const { count: contactRequestCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      setContactCount(contactRequestCount || 0);
      console.log('✅ Contacts loaded:', contactRequestCount);
    } catch (error) {
      console.error('❌ Error loading contacts count:', error);
      if (error.message?.includes('429')) {
        throw error;
      }
    }
  };

  const loadEventsCount = async () => {
    if (!user || isRateLimited) return;
    
    try {
      console.log('📅 Loading events count...');
      const { count: eventRsvpCount } = await supabase
        .from('maw3d_rsvps')
        .select(`
          *,
          maw3d_events!inner(created_by)
        `, { count: 'exact', head: true })
        .eq('maw3d_events.created_by', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setMaw3dEventCount(eventRsvpCount || 0);
      console.log('✅ Events loaded:', eventRsvpCount);
    } catch (error) {
      console.error('❌ Error loading events count:', error);
      if (error.message?.includes('429')) {
        throw error;
      }
    }
  };

  const loadTasksCount = async () => {
    if (!user || isRateLimited) return;
    
    try {
      console.log('📋 Loading tasks count...');
      const { count: sharedTaskResponseCount } = await supabase
        .from('tr_shared_responses')
        .select(`
          *,
          tr_tasks!inner(user_id)
        `, { count: 'exact', head: true })
        .eq('tr_tasks.user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setSharedTaskCount(sharedTaskResponseCount || 0);
      setTaskCount(0);
      console.log('✅ Tasks loaded:', sharedTaskResponseCount);
    } catch (error) {
      console.error('❌ Error loading tasks count:', error);
      if (error.message?.includes('429')) {
        throw error;
      }
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!user || !isInitialized || isRateLimited) {
      console.log('⚠️ Skipping subscriptions - not ready');
      return;
    }

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
        
        // Use longer debounce to prevent rapid requests
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
    if (!user || !isInitialized || isRateLimited) {
      console.log('⚠️ Skipping fetch - not ready');
      return;
    }

    try {
      console.log('📊 Fetching unread counts (debounced)');
      await progressivelyLoadCounts();
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error);
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('⚠️ Rate limited in fetch, backing off');
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 30000);
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
