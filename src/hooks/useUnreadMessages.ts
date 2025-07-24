
import { useState, useEffect, useCallback } from 'react';
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
  const [isTokenRefreshing, setIsTokenRefreshing] = useState(false);
  const [requestQueue, setRequestQueue] = useState<(() => Promise<void>)[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Circuit breaker state
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState(0);
  const CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 seconds

  // Debounced fetch function with much longer delay
  const debouncedFetchUnreadCounts = useDebounced(fetchUnreadCounts, 5000);

  // Token refresh detection
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        setIsTokenRefreshing(true);
        setTimeout(() => setIsTokenRefreshing(false), 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Request queue processor
  const processRequestQueue = useCallback(async () => {
    if (isProcessingQueue || requestQueue.length === 0) return;
    
    setIsProcessingQueue(true);
    
    while (requestQueue.length > 0) {
      const request = requestQueue.shift();
      if (request) {
        try {
          await request();
          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error('Request queue error:', error);
        }
      }
    }
    
    setIsProcessingQueue(false);
  }, [requestQueue, isProcessingQueue]);

  // Check circuit breaker
  const isCircuitBreakerOpen = useCallback(() => {
    if (!circuitBreakerOpen) return false;
    
    const timeSinceLastError = Date.now() - lastErrorTime;
    if (timeSinceLastError > CIRCUIT_BREAKER_TIMEOUT) {
      setCircuitBreakerOpen(false);
      return false;
    }
    
    return true;
  }, [circuitBreakerOpen, lastErrorTime]);

  // Handle rate limiting
  const handleRateLimit = useCallback(() => {
    setIsRateLimited(true);
    setCircuitBreakerOpen(true);
    setLastErrorTime(Date.now());
    
    setTimeout(() => {
      setIsRateLimited(false);
    }, 30000); // 30 seconds
  }, []);

  // Check if we can make requests
  const canMakeRequest = useCallback(() => {
    return !authLoading && 
           !isTokenRefreshing && 
           !isRateLimited && 
           !isCircuitBreakerOpen() && 
           user;
  }, [authLoading, isTokenRefreshing, isRateLimited, isCircuitBreakerOpen, user]);

  useEffect(() => {
    // Early return if not ready
    if (authLoading || !user || isRateLimited || isCircuitBreakerOpen()) {
      if (!user) {
        resetCounts();
      }
      return;
    }

    console.log('🔄 Setting up unread message tracking for user:', user.id);

    // Much longer delay before initializing
    const initTimeout = setTimeout(() => {
      if (canMakeRequest()) {
        console.log('🚀 Starting initialization with batched requests');
        initializeUnreadCounts();
      }
    }, 8000); // Increased to 8 seconds

    return () => {
      clearTimeout(initTimeout);
      cleanupSubscriptions();
    };
  }, [user, authLoading, isRateLimited, canMakeRequest]);

  // Process queue when conditions are met
  useEffect(() => {
    if (canMakeRequest()) {
      processRequestQueue();
    }
  }, [canMakeRequest, processRequestQueue]);

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
    if (!canMakeRequest()) {
      console.log('⚠️ Cannot make request - conditions not met');
      return;
    }

    try {
      console.log('📊 Starting batched count loading');
      await loadAllCountsBatched();
      
      // Only set up subscriptions after successful loading
      setTimeout(() => {
        if (canMakeRequest()) {
          setupRealtimeSubscriptions();
          setIsInitialized(true);
        }
      }, 3000);
    } catch (error) {
      console.error('❌ Error initializing unread counts:', error);
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        handleRateLimit();
      }
    }
  };

  // Batched count loading - single query to get all counts
  const loadAllCountsBatched = async () => {
    if (!canMakeRequest()) return;

    try {
      console.log('📊 Loading all counts in batched query');
      
      // Create a single batched query using Promise.all with staggered execution
      const batchedQueries = [
        () => loadMessagesCount(),
        () => loadContactsCount(),
        () => loadEventsCount(),
        () => loadTasksCount()
      ];

      // Execute queries with staggered timing to prevent token refresh cascade
      for (const query of batchedQueries) {
        if (!canMakeRequest()) break;
        
        await query();
        // Stagger requests to prevent rapid token refreshes
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('✅ All counts loaded successfully');
    } catch (error) {
      console.error('❌ Error in batched loading:', error);
      throw error;
    }
  };

  const loadMessagesCount = async () => {
    if (!canMakeRequest()) return;
    
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
        throw error;
      }
    }
  };

  const loadContactsCount = async () => {
    if (!canMakeRequest()) return;
    
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
    if (!canMakeRequest()) return;
    
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
    if (!canMakeRequest()) return;
    
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
    if (!canMakeRequest() || !isInitialized) {
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
        
        // Queue the refresh instead of immediate execution
        setRequestQueue(prev => [...prev, () => fetchUnreadCounts()]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`
      }, () => {
        setRequestQueue(prev => [...prev, () => fetchUnreadCounts()]);
      })
      .subscribe();

    // Store channels for cleanup
    window.unreadChannels = [messagesChannel];
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
    if (!canMakeRequest() || !isInitialized) {
      console.log('⚠️ Skipping fetch - not ready');
      return;
    }

    try {
      console.log('📊 Fetching unread counts (debounced)');
      await loadAllCountsBatched();
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error);
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        handleRateLimit();
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
