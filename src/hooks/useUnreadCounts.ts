
import { useUnreadContext } from '@/contexts/UnreadContext';

export function useUnreadCounts() {
  // Use the unified notification system instead of waktiBadges
  const { 
    unreadTotal: messageCount,
    contactCount,
    maw3dEventCount: eventCount,
    taskCount: totalTaskCount,
    sharedTaskCount
  } = useUnreadContext();

  // Combine task counts for compatibility
  const taskCount = totalTaskCount + sharedTaskCount;

  return {
    messageCount,
    contactCount,
    eventCount,
    taskCount
  };
}
