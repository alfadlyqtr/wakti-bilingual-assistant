/**
 * useNotificationHistory
 * 
 * Subscribes to the unified notification_history table for real-time in-app notifications.
 * This covers ALL notification types including:
 * - message_received
 * - contact_request
 * - maw3d_rsvp
 * - shared_task_update
 * - admin_gifts
 * - task_due (NEW)
 * - reminder_due (NEW)
 */

// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, ensurePassport } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { waktiToast } from '@/services/waktiToast';

interface NotificationHistoryRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  deep_link: string | null;
  is_read: boolean;
  push_sent: boolean;
  created_at: string;
}

// Map notification types to toast types and sounds
const NOTIFICATION_CONFIG: Record<string, { toastType: string; sound: string; priority: string }> = {
  message_received: { toastType: 'message', sound: 'chime', priority: 'normal' },
  contact_request: { toastType: 'contact', sound: 'ding', priority: 'normal' },
  maw3d_rsvp: { toastType: 'event', sound: 'beep', priority: 'normal' },
  event_rsvp: { toastType: 'event', sound: 'beep', priority: 'normal' },
  shared_task_update: { toastType: 'shared_task', sound: 'chime', priority: 'normal' },
  admin_gifts: { toastType: 'admin', sound: 'ding', priority: 'high' },
  task_due: { toastType: 'task', sound: 'chime', priority: 'high' },
  reminder_due: { toastType: 'task', sound: 'ding', priority: 'high' },
  subscription_activated: { toastType: 'admin', sound: 'ding', priority: 'normal' },
  payment_refunded: { toastType: 'admin', sound: 'ding', priority: 'normal' },
};

// Global deduplication
let globalSetupInProgress = false;
let globalUserId: string | null = null;

export function useNotificationHistory() {
  const DEV = !!(import.meta && import.meta.env && import.meta.env.DEV);
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationHistoryRow[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Fetch unread count from notification_history
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      await ensurePassport();
      
      // Count unread notifications from last 24 hours
      const { count, error } = await supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Error fetching notification count:', error);
        return;
      }

      setUnreadCount(count || 0);
      if (DEV) console.log('🔔 Notification history unread count:', count);
    } catch (error) {
      console.error('Error in fetchUnreadCount:', error);
    }
  }, [user?.id, DEV]);

  // Fetch recent notifications
  const fetchRecentNotifications = useCallback(async (limit = 20) => {
    if (!user?.id) return;

    try {
      await ensurePassport();
      
      const { data, error } = await supabase
        .from('notification_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent notifications:', error);
        return;
      }

      setRecentNotifications(data || []);
    } catch (error) {
      console.error('Error in fetchRecentNotifications:', error);
    }
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      await ensurePassport();
      
      const { error } = await supabase
        .from('notification_history')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setRecentNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  }, [user?.id]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      await ensurePassport();
      
      const { error } = await supabase
        .from('notification_history')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return;
      }

      setRecentNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  }, [user?.id]);

  // Show toast for a notification
  const showNotificationToast = useCallback(async (notification: NotificationHistoryRow) => {
    // Skip if already processed
    if (processedIdsRef.current.has(notification.id)) {
      return;
    }
    processedIdsRef.current.add(notification.id);

    const config = NOTIFICATION_CONFIG[notification.type] || {
      toastType: 'task' as const,
      sound: 'chime' as const,
      priority: 'normal' as const,
    };

    await waktiToast.show({
      id: `notif-${notification.id}`,
      type: config.toastType,
      title: notification.title,
      message: notification.body,
      priority: config.priority,
      sound: config.sound,
    });

    if (DEV) console.log('🔔 Showed toast for notification:', notification.type, notification.title);
  }, [DEV]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    // Global deduplication
    if (globalSetupInProgress || globalUserId === user.id) {
      if (DEV) console.log('⏭️ Notification history subscription already running');
      return;
    }

    globalSetupInProgress = true;
    globalUserId = user.id;

    let channel: any;

    const setup = async () => {
      try {
        await ensurePassport();
        
        // Initial fetch
        await fetchUnreadCount();
        await fetchRecentNotifications();

        if (DEV) console.log('🔔 Setting up notification_history subscription for user:', user.id);

        // Subscribe to new notifications
        channel = supabase
          .channel(`notification-history:${user.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_history',
            filter: `user_id=eq.${user.id}`
          }, async (payload) => {
            const notification = payload.new as NotificationHistoryRow;
            if (DEV) console.log('🔔 New notification received:', notification.type, notification.title);

            // Show toast
            await showNotificationToast(notification);

            // Update counts and list
            setUnreadCount(prev => prev + 1);
            setRecentNotifications(prev => [notification, ...prev.slice(0, 19)]);
          })
          .subscribe((status) => {
            if (DEV) console.log('🔔 Notification history subscription status:', status);
          });

      } catch (error) {
        console.error('Error setting up notification history subscription:', error);
      }
    };

    setup();

    return () => {
      if (DEV) console.log('🧹 Cleaning up notification history subscription');
      if (channel) supabase.removeChannel(channel);
      globalSetupInProgress = false;
      globalUserId = null;
    };
  }, [user?.id, DEV, fetchUnreadCount, fetchRecentNotifications, showNotificationToast]);

  return {
    unreadCount,
    recentNotifications,
    fetchUnreadCount,
    fetchRecentNotifications,
    markAsRead,
    markAllAsRead,
  };
}
