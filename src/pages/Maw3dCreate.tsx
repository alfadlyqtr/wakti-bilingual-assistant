
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { waktiNotifications } from '@/services/waktiNotifications';
import { CreateEventForm } from '@/components/maw3d/CreateEventForm';

export default function Maw3dCreate() {
  const { user } = useAuth();

  // Initialize WAKTI notification service for Maw3d create page
  useEffect(() => {
    if (user?.id) {
      console.log('🔥 Initializing WAKTI notification service for Maw3d create page');
      waktiNotifications.startNotificationProcessor(user.id);
    }

    return () => {
      waktiNotifications.stopNotificationProcessor();
    };
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <CreateEventForm />
    </div>
  );
}
