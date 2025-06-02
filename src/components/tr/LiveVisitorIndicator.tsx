
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Eye } from 'lucide-react';
import { TRSharedService, TRSharedAccessExtended } from '@/services/trSharedService';

interface LiveVisitorIndicatorProps {
  taskId: string;
  currentSessionId?: string;
}

export const LiveVisitorIndicator: React.FC<LiveVisitorIndicatorProps> = ({
  taskId,
  currentSessionId
}) => {
  const [activeVisitors, setActiveVisitors] = useState<TRSharedAccessExtended[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveVisitors();
    
    // Set up real-time subscription
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, () => {
      loadActiveVisitors();
    });

    // Cleanup
    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const loadActiveVisitors = async () => {
    try {
      const visitors = await TRSharedService.getActiveVisitors(taskId);
      setActiveVisitors(visitors);
    } catch (error) {
      console.error('Error loading active visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const otherVisitors = activeVisitors.filter(v => v.session_id !== currentSessionId);
  
  if (loading) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Eye className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  if (otherVisitors.length === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <Users className="h-3 w-3 mr-1" />
      {otherVisitors.length} other viewer{otherVisitors.length > 1 ? 's' : ''} online
    </Badge>
  );
};
