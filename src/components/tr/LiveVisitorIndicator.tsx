
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck } from 'lucide-react';
import { TRSharedService, TRSharedAccessExtended } from '@/services/trSharedService';

interface LiveVisitorIndicatorProps {
  taskId: string;
  currentSessionId?: string;
}

export const LiveVisitorIndicator: React.FC<LiveVisitorIndicatorProps> = ({
  taskId,
  currentSessionId
}) => {
  const [activeAssignees, setActiveAssignees] = useState<TRSharedAccessExtended[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveAssignees();
    
    // Set up real-time subscription
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, () => {
      loadActiveAssignees();
    });

    // Cleanup
    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const loadActiveAssignees = async () => {
    try {
      const assignees = await TRSharedService.getActiveVisitors(taskId);
      setActiveAssignees(assignees);
    } catch (error) {
      console.error('Error loading active assignees:', error);
    } finally {
      setLoading(false);
    }
  };

  const otherAssignees = activeAssignees.filter(v => v.session_id !== currentSessionId);
  
  if (loading) {
    return (
      <Badge variant="secondary" className="text-xs">
        <UserCheck className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  if (otherAssignees.length === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <Users className="h-3 w-3 mr-1" />
      {otherAssignees.length} other assignee{otherAssignees.length > 1 ? 's' : ''} active
    </Badge>
  );
};
