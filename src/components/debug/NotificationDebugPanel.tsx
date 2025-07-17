
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Info, AlertCircle } from 'lucide-react';

export const NotificationDebugPanel: React.FC = () => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          WAKTI Notifications Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
          <Info className="h-4 w-4 text-blue-500" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Notifications are now handled by the unified useUnreadMessages system with real-time updates.
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Real-time Status</h4>
          <div className="flex items-center gap-2">
            <Badge variant="default">Active</Badge>
            <span className="text-sm text-muted-foreground">
              All notifications working via real-time channels
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Supported Notifications</h4>
          <div className="text-xs space-y-1">
            <div>✅ Messages</div>
            <div>✅ Contact Requests</div>
            <div>✅ Task Updates</div>
            <div>✅ Shared Tasks</div>
            <div>✅ Event RSVPs</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
