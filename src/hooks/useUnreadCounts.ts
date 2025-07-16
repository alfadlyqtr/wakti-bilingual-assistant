
import { useState, useEffect } from 'react';
import { waktiBadges } from '@/services/waktiBadges';

export function useUnreadCounts() {
  const [messageCount, setMessageCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    // Get initial counts
    const updateCounts = () => {
      setMessageCount(waktiBadges.getBadgeCount('message'));
      setContactCount(waktiBadges.getBadgeCount('contact'));
      setEventCount(waktiBadges.getBadgeCount('event'));
      setTaskCount(waktiBadges.getBadgeCount('task') + waktiBadges.getBadgeCount('shared_task'));
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
