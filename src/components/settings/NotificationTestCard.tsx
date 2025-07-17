
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Bell, 
  MessageSquare, 
  Users, 
  CheckSquare, 
  Calendar,
  Gift,
  TestTube
} from 'lucide-react';

export const NotificationTestCard: React.FC = () => {
  const [testing, setTesting] = useState<string | null>(null);

  const testNotifications = [
    {
      id: 'message',
      icon: MessageSquare,
      label: 'Message',
      title: 'New Message',
      description: 'You have received a new message from a contact',
      color: 'text-blue-500'
    },
    {
      id: 'contact',
      icon: Users,
      label: 'Contact Request',
      title: 'New Contact Request',
      description: 'Someone wants to connect with you',
      color: 'text-green-500'
    },
    {
      id: 'task',
      icon: CheckSquare,
      label: 'Task Update',
      title: 'Task Completed',
      description: 'Someone completed your shared task',
      color: 'text-orange-500'
    },
    {
      id: 'event',
      icon: Calendar,
      label: 'Event RSVP',
      title: 'Event Response',
      description: 'Someone responded to your event invitation',
      color: 'text-purple-500'
    },
    {
      id: 'gift',
      icon: Gift,
      label: 'Admin Gift',
      title: 'Gift Received!',
      description: 'You received a gift from the Wakti Admin Team',
      color: 'text-pink-500'
    }
  ];

  const handleTestNotification = async (notification: typeof testNotifications[0]) => {
    setTesting(notification.id);
    
    try {
      // Show toast notification
      toast(notification.title, {
        description: notification.description,
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => console.log(`Viewing ${notification.label}`)
        }
      });
      
      // Simulate vibration on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      // Play notification sound (simplified)
      try {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.1;
        audio.play().catch(() => {
          console.log('Audio play failed - this is normal in some browsers');
        });
      } catch (error) {
        console.log('Audio not available');
      }
      
    } catch (error) {
      console.error('Error testing notification:', error);
      toast.error('Failed to test notification');
    } finally {
      setTimeout(() => setTesting(null), 1000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Test different types of notifications to see how they appear and sound.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {testNotifications.map((notification) => {
              const Icon = notification.icon;
              const isLoading = testing === notification.id;
              
              return (
                <Button
                  key={notification.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2"
                  onClick={() => handleTestNotification(notification)}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`h-4 w-4 ${notification.color}`} />
                    <span className="font-medium">{notification.label}</span>
                    {isLoading && (
                      <Badge variant="secondary" className="ml-auto">
                        Testing...
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    {notification.description}
                  </span>
                </Button>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4" />
              <span className="font-medium">Note:</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Test notifications respect your current notification settings. 
              If you don't see or hear anything, check your notification preferences above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
