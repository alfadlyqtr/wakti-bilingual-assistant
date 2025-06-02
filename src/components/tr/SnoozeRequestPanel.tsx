
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TRSnoozeRequest } from '@/services/trSharedService';
import { Clock, Check, X, User } from 'lucide-react';
import { format } from 'date-fns';

interface SnoozeRequestPanelProps {
  snoozeRequests: TRSnoozeRequest[];
  onRequestUpdate: (requestId: string, status: 'approved' | 'denied') => Promise<void>;
}

export const SnoozeRequestPanel: React.FC<SnoozeRequestPanelProps> = ({
  snoozeRequests,
  onRequestUpdate
}) => {
  if (snoozeRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Clock className="h-5 w-5" />
          Pending Snooze Requests ({snoozeRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {snoozeRequests.map((request) => (
          <div key={request.id} className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{request.visitor_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(request.created_at), 'MMM dd, HH:mm')}
                  </Badge>
                </div>
                
                {request.reason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    "{request.reason}"
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onRequestUpdate(request.id, 'approved')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRequestUpdate(request.id, 'denied')}
                className="flex-1"
              >
                <X className="h-3 w-3 mr-1" />
                Deny
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
