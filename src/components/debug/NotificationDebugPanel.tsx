
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, Play, Square } from 'lucide-react';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { toast } from 'sonner';

export const NotificationDebugPanel: React.FC = () => {
  const { 
    unreadTotal, 
    taskCount, 
    contactCount, 
    sharedTaskCount, 
    maw3dEventCount,
    loading 
  } = useUnreadMessages();

  const testNotifications = [
    { type: 'messages', label: 'Message' },
    { type: 'tasks', label: 'Task Update' },
    { type: 'contacts', label: 'Contact Request' },
    { type: 'events', label: 'Event Response' }
  ];

  const handleTestNotification = (type: string) => {
    switch (type) {
      case 'messages':
        toast('New Message', { description: 'You have new unread messages' });
        break;
      case 'tasks':
        toast('Task Update', { description: 'Your task status has changed' });
        break;
      case 'contacts':
        toast('Contact Request', { description: 'Someone wants to connect with you' });
        break;
      case 'events':
        toast('Event Response', { description: 'Someone responded to your event' });
        break;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          WAKTI Notifications Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="space-y-2">
          <h4 className="font-medium">System Status</h4>
          <div className="flex items-center gap-2">
            {!loading ? (
              <>
                <Play className="h-4 w-4 text-green-500" />
                <Badge variant="default">Active</Badge>
              </>
            ) : (
              <>
                <Square className="h-4 w-4 text-orange-500" />
                <Badge variant="secondary">Loading</Badge>
              </>
            )}
          </div>
        </div>

        {/* Notification Counts */}
        <div className="space-y-2">
          <h4 className="font-medium">Current Counts</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Badge variant="outline">{unreadTotal}</Badge>
              Messages
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{taskCount}</Badge>
              Tasks
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{contactCount}</Badge>
              Contacts
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline">{maw3dEventCount}</Badge>
              Events
            </div>
          </div>
        </div>

        {/* Test Notifications */}
        <div className="space-y-2">
          <h4 className="font-medium">Test Notifications</h4>
          <div className="grid grid-cols-2 gap-2">
            {testNotifications.map(({ type, label }) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification(type)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
