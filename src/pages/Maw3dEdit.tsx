
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { wn1NotificationService } from '@/services/wn1NotificationService';
import { EditEventForm } from '@/components/maw3d/EditEventForm';

export default function Maw3dEdit() {
  const { user } = useAuth();

  // Initialize WN1 notification service for Maw3d edit page
  useEffect(() => {
    if (user?.id) {
      console.log('🔥 Initializing WN1 notification service for Maw3d edit page');
      wn1NotificationService.initialize(user.id);
    }

    return () => {
      wn1NotificationService.cleanup();
    };
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <EditEventForm />
    </div>
  );
}
