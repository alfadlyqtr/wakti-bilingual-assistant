
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { waktiNotifications } from '@/services/waktiNotifications';
import { EditEventForm } from '@/components/maw3d/EditEventForm';

export default function Maw3dEdit() {
  const { user } = useAuth();

  // Initialize WAKTI notification service for Maw3d edit page
  useEffect(() => {
    if (user?.id) {
      console.log('🔥 Initializing WAKTI notification service for Maw3d edit page');
      waktiNotifications.startNotificationProcessor(user.id);
    }

    return () => {
      waktiNotifications.stopNotificationProcessor();
    };
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <EditEventForm />
    </div>
  );
}
