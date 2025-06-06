
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, User } from 'lucide-react';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';

interface LiveVisitorIndicatorProps {
  taskId: string;
  className?: string;
}

export const LiveVisitorIndicator: React.FC<LiveVisitorIndicatorProps> = ({
  taskId,
  className = ""
}) => {
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResponses();
    
    // Set up real-time subscription
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, loadResponses);
    
    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const loadResponses = async () => {
    try {
      const responsesData = await TRSharedService.getTaskResponses(taskId);
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique active visitors based on recent responses
  const getActiveVisitors = (): string[] => {
    const recentResponses = responses.filter(
      r => new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );
    
    const uniqueVisitors = [...new Set(recentResponses.map(r => r.visitor_name))];
    return uniqueVisitors;
  };

  if (loading) {
    return null;
  }

  const activeVisitors = getActiveVisitors();
  
  if (activeVisitors.length === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className={`flex items-center gap-1 ${className}`}>
      {activeVisitors.length === 1 ? (
        <User className="h-3 w-3" />
      ) : (
        <Users className="h-3 w-3" />
      )}
      <span className="text-xs">
        {activeVisitors.length === 1 
          ? `${activeVisitors[0]} active`
          : `${activeVisitors.length} people active`
        }
      </span>
    </Badge>
  );
};
