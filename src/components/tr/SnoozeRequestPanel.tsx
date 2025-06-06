
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TRSharedResponse } from '@/services/trSharedService';
import { Clock, Check, X, User } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface SnoozeRequestPanelProps {
  snoozeRequests: TRSharedResponse[];
  onRequestUpdate: (requestId: string, status: 'approved' | 'denied') => void;
}

export const SnoozeRequestPanel: React.FC<SnoozeRequestPanelProps> = ({
  snoozeRequests,
  onRequestUpdate
}) => {
  const { language } = useTheme();

  if (snoozeRequests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-orange-600" />
          {t('pendingSnoozeRequests', language)} ({snoozeRequests.length})
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {snoozeRequests.map((request) => (
          <div key={request.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{request.visitor_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(request.created_at), 'MMM dd, HH:mm')}
                  </Badge>
                </div>
                
                {request.content && (
                  <p className="text-sm text-muted-foreground mt-2">
                    "{request.content}"
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => onRequestUpdate(request.id, 'approved')}
                size="sm"
                variant="default"
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                {t('approve', language)}
              </Button>
              
              <Button
                onClick={() => onRequestUpdate(request.id, 'denied')}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />
                {t('deny', language)}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
