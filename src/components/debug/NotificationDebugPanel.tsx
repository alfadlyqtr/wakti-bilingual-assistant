
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { wn1NotificationService } from '@/services/wn1NotificationService';
import { Bell, Check, X, Play, Square } from 'lucide-react';

export const NotificationDebugPanel: React.FC = () => {
  const [processorStatus, setProcessorStatus] = useState(wn1NotificationService.getProcessorStatus());
  const [config, setConfig] = useState(wn1NotificationService.getPreferences());

  useEffect(() => {
    const interval = setInterval(() => {
      setProcessorStatus(wn1NotificationService.getProcessorStatus());
      setConfig(wn1NotificationService.getPreferences());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const testNotifications = [
    { type: 'shared_task', label: 'Shared Task' },
    { type: 'event', label: 'Maw3d Event' },
    { type: 'messages', label: 'Message' },
    { type: 'contact_requests', label: 'Contact Request' }
  ];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          WAKTI Notifications Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Processor Status */}
        <div className="space-y-2">
          <h4 className="font-medium">Processor Status</h4>
          <div className="flex items-center gap-2">
            {processorStatus.active ? (
              <>
                <Play className="h-4 w-4 text-green-500" />
                <Badge variant="default">Active</Badge>
              </>
            ) : (
              <>
                <Square className="h-4 w-4 text-red-500" />
                <Badge variant="destructive">Inactive</Badge>
              </>
            )}
          </div>
          {processorStatus.userId && (
            <p className="text-xs text-muted-foreground">
              User: {processorStatus.userId.substring(0, 8)}...
            </p>
          )}
        </div>

        {/* Configuration Status */}
        <div className="space-y-2">
          <h4 className="font-medium">Configuration</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              {config.enableToasts ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-red-500" />}
              Toasts
            </div>
            <div className="flex items-center gap-1">
              {config.enableSounds ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-red-500" />}
              Sounds
            </div>
            <div className="flex items-center gap-1">
              {config.enableBadges ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-red-500" />}
              Badges
            </div>
            <div className="flex items-center gap-1">
              {config.enableVibration ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-red-500" />}
              Vibration
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
                onClick={() => wn1NotificationService.testNotification(type)}
                disabled={!processorStatus.active}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Clear All Badges */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            ['task', 'shared_task', 'event', 'message', 'contact'].forEach(type => {
              wn1NotificationService.clearBadge(type);
            });
          }}
        >
          Clear All Badges
        </Button>
      </CardContent>
    </Card>
  );
};
