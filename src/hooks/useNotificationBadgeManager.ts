
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useEffect } from 'react';

export function useNotificationBadgeManager() {
  const { 
    unreadTotal, 
    contactCount, 
    maw3dEventCount, 
    taskCount, 
    sharedTaskCount, 
    resetBadges,
    markEventNotificationsAsRead 
  } = useUnreadMessages();

  // Auto-refresh badges every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing notification badges');
      resetBadges();
    }, 30000);

    return () => clearInterval(interval);
  }, [resetBadges]);

  const getTotalBadgeCount = () => {
    return unreadTotal + contactCount + maw3dEventCount + taskCount + sharedTaskCount;
  };

  const clearAllBadges = () => {
    console.log('🧹 Clearing all notification badges');
    resetBadges();
  };

  const clearEventBadges = (eventId?: string) => {
    console.log('🧹 Clearing event notification badges', eventId);
    markEventNotificationsAsRead(eventId);
  };

  return {
    unreadTotal,
    contactCount,
    maw3dEventCount,
    taskCount,
    sharedTaskCount,
    getTotalBadgeCount,
    clearAllBadges,
    clearEventBadges,
    resetBadges
  };
}
