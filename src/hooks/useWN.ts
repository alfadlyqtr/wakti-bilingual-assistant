
import { useEffect, useState } from 'react';
import { WN, WNState } from '@/services/WN';

export function useWN() {
  const [state, setState] = useState<WNState>(WN.getState());

  useEffect(() => {
    // Set initial state
    setState(WN.getState());

    // Subscribe to state changes
    const handleStateChange = (newState: WNState) => {
      setState(newState);
    };

    WN.addStateListener(handleStateChange);

    return () => {
      WN.removeStateListener(handleStateChange);
    };
  }, []);

  return {
    // Exact same interface as useUnreadMessages for seamless transition
    unreadTotal: state.unreadTotal,
    unreadPerContact: state.unreadPerContact,
    taskCount: state.taskCount,
    eventCount: state.eventCount,
    contactCount: state.contactCount,
    sharedTaskCount: state.sharedTaskCount,
    maw3dEventCount: state.maw3dEventCount,
    loading: state.loading,
    refetch: () => WN.refetch(),
    
    // Additional WN-specific methods
    clearBadgeOnPageVisit: (pageType: 'tr' | 'maw3d' | 'messages' | 'contacts') => WN.clearBadgeOnPageVisit(pageType),
    getBadgeDisplay: (type: string) => WN.getBadgeDisplay(type),
    testNotification: (type: string) => WN.testNotification(type)
  };
}
