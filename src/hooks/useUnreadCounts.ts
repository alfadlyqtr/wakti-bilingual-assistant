
import { useState, useEffect } from 'react';
import { waktiBadges } from '@/services/waktiBadges';

export function useUnreadCounts() {
  const [messageCount, setMessageCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    // Get initial counts with standardized badge types
    const updateCounts = () => {
      setMessageCount(waktiBadges.getBadgeCount('messages'));
      setContactCount(waktiBadges.getBadgeCount('contact_requests'));
      setEventCount(waktiBadges.getBadgeCount('maw3d_events')); // Standardized
      setTaskCount(waktiBadges.getBadgeCount('task_updates') + waktiBadges.getBadgeCount('shared_tasks'));
    };

    updateCounts();

    // Listen for badge updates
    const handleBadgeUpdate = () => {
      updateCounts();
    };

    window.addEventListener('badge-updated', handleBadgeUpdate);

    return () => {
      window.removeEventListener('badge-updated', handleBadgeUpdate);
    };
  }, []);

  return {
    messageCount,
    contactCount,
    eventCount,
    taskCount
  };
}
