
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { wn1NotificationService } from '@/services/wn1NotificationService';
import { CreateEventForm } from '@/components/maw3d/CreateEventForm';

export default function Maw3dCreate() {
  const { user } = useAuth();

  // Initialize WN1 notification service for Maw3d create page
  useEffect(() => {
    if (user?.id) {
      console.log('🔥 Initializing WN1 notification service for Maw3d create page');
      wn1NotificationService.initialize(user.id);
    }

    return () => {
      wn1NotificationService.cleanup();
    };
  }, [user?.id]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <CreateEventForm />
    </div>
  );
}
