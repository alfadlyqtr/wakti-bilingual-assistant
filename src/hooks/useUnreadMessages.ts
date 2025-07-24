
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';

export function useUnreadMessages() {
  const { user, isLoading: authLoading, isTokenRefreshing } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [sharedTaskCount, setSharedTaskCount] = useState(0);
  const [perContactUnread, setPerContactUnread] = useState<Record<string, number>>({});

  // Simple condition check
  const canMakeRequest = useCallback(() => {
    return !authLoading && !isTokenRefreshing && user;
  }, [authLoading, isTokenRefreshing, user]);

  const resetCounts = () => {
    setUnreadTotal(0);
    setContactCount(0);
    setMaw3dEventCount(0);
    setTaskCount(0);
    setSharedTaskCount(0);
    setPerContactUnread({});
  };

  // Simple batched loading function
  const loadAllCounts = async () => {
    if (!canMakeRequest()) return;

    try {
      console.log('📊 Loading unread counts...');
      
      // Simple message count
      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setUnreadTotal(messageCount || 0);

      // Simple contact count
      const { count: contactRequestCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', user.id)
        .eq('status', 'pending');

      setContactCount(contactRequestCount || 0);

      console.log('✅ Counts loaded successfully');
    } catch (error) {
      console.error('❌ Error loading counts:', error);
    }
  };

  useEffect(() => {
    // Don't do anything if auth is loading or user is not available
    if (authLoading || !user) {
      if (!user) {
        resetCounts();
      }
      return;
    }

    // Simple delay then load counts
    const timer = setTimeout(() => {
      if (canMakeRequest()) {
        loadAllCounts();
      }
    }, 5000); // 5 second delay

    return () => clearTimeout(timer);
  }, [user, authLoading, canMakeRequest]);

  return {
    unreadTotal,
    contactCount,
    maw3dEventCount,
    taskCount,
    sharedTaskCount,
    perContactUnread,
    refetch: () => {
      if (canMakeRequest()) {
        loadAllCounts();
      }
    }
  };
}
