
import { useState, useEffect } from 'react';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

export function useUnreadCounts() {
  // Use the unified notification system instead of waktiBadges
  const { 
    unreadTotal: messageCount,
    contactCount,
    maw3dEventCount: eventCount,
    taskCount: totalTaskCount,
    sharedTaskCount
  } = useUnreadMessages();

  // Combine task counts for compatibility
  const taskCount = totalTaskCount + sharedTaskCount;

  return {
    messageCount,
    contactCount,
    eventCount,
    taskCount
  };
}
