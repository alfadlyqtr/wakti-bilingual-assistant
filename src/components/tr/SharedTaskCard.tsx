
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { LiveVisitorIndicator } from './LiveVisitorIndicator';
import { ExternalLink, Calendar, Users, MessageCircle } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface SharedTaskCardProps {
  task: TRTask;
  assignees: any[]; // Keep for compatibility but we'll use responses instead
  onTaskUpdated: () => void;
}

export const SharedTaskCard: React.FC<SharedTaskCardProps> = ({
  task,
  onTaskUpdated
}) => {
  const { language } = useTheme();
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);

  useEffect(() => {
    loadResponses();
    
    // Real-time subscription
    const channel = TRSharedService.subscribeToTaskUpdates(task.id, loadResponses);
    return () => {
      channel.unsubscribe();
    };
  }, [task.id]);

  const loadResponses = async () => {
    try {
      const responsesData = await TRSharedService.getTaskResponses(task.id);
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  const isOverdue = (task: TRTask) => {
    if (task.completed) return false;
    const now = new Date();
    const dueDateTime = task.due_time 
      ? parseISO(`${task.due_date}T${task.due_time}`)
      : parseISO(`${task.due_date}T23:59:59`);
    return isAfter(now, dueDateTime);
  };

  const openSharedTask = () => {
    if (task.share_link) {
      window.open(`/shared/${task.share_link}`, '_blank');
    }
  };

  // Get stats from responses
  const completionResponses = responses.filter(r => r.response_type === 'completion' && r.is_completed);
  const commentResponses = responses.filter(r => r.response_type === 'comment');
  const snoozeRequests = responses.filter(r => r.response_type === 'snooze_request');
  const uniqueVisitors = [...new Set(responses.map(r => r.visitor_name))];

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base leading-tight break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </CardTitle>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <PriorityBadge priority={task.priority} />
              <StatusBadge completed={task.completed} isOverdue={task.due_date ? isOverdue(task) : false} />
              <Badge variant="outline" className="text-xs">
                {t('shared', language)}
              </Badge>
            </div>
          </div>
          
          <LiveVisitorIndicator taskId={task.id} />
        </div>
        
        {task.due_date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Calendar className="w-4 h-4" />
            <span>
              Due {format(parseISO(task.due_date), 'MMM dd, yyyy')}
              {task.due_time && ` at ${task.due_time}`}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Activity Summary */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-secondary/20 rounded-lg p-2">
            <div className="text-sm font-semibold">{uniqueVisitors.length}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Users className="h-3 w-3" />
              {t('visitors', language)}
            </div>
          </div>
          
          <div className="bg-secondary/20 rounded-lg p-2">
            <div className="text-sm font-semibold">{completionResponses.length}</div>
            <div className="text-xs text-muted-foreground">
              {t('completions', language)}
            </div>
          </div>
          
          <div className="bg-secondary/20 rounded-lg p-2">
            <div className="text-sm font-semibold">{commentResponses.length}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {t('comments', language)}
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        {snoozeRequests.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-sm font-medium text-orange-800">
              {snoozeRequests.length} pending snooze request{snoozeRequests.length > 1 ? 's' : ''}
            </div>
            <div className="text-xs text-orange-600 mt-1">
              Check the task to review requests
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={openSharedTask}
            size="sm"
            className="flex-1"
            disabled={!task.share_link}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('openSharedView', language)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
