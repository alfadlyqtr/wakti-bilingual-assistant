
import React, { useState, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TRService, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { toast } from 'sonner';
import { CheckCircle, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SimpleSubtaskManagerProps {
  taskId: string;
  visitorName: string;
}

export const SimpleSubtaskManager: React.FC<SimpleSubtaskManagerProps> = ({
  taskId,
  visitorName
}) => {
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // NEW: Track local (optimistic) subtask complete states keyed by subtaskId
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});
  // For race condition protection, to cancel pending backend updates if unmounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    loadData();

    // Real-time subscription
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, loadResponses);
    return () => {
      isMounted.current = false;
      channel.unsubscribe();
    };
  }, [taskId]);

  // Every time real responses arrive, if they match the optimisticCompleted, clear that subtask's optimistic state
  useEffect(() => {
    // If optimisticCompleted doesn't match the latest server state, clear it
    const newOptimistic = { ...optimisticCompleted };
    let changed = false;
    for (const subtaskId of Object.keys(optimisticCompleted)) {
      const isNowCompleted = responses.some(
        r =>
          r.subtask_id === subtaskId &&
          r.visitor_name === visitorName &&
          r.response_type === 'completion' &&
          r.is_completed
      );
      if (typeof optimisticCompleted[subtaskId] === 'boolean' && isNowCompleted === optimisticCompleted[subtaskId]) {
        delete newOptimistic[subtaskId];
        changed = true;
      }
    }
    if (changed) setOptimisticCompleted(newOptimistic);
    // eslint-disable-next-line
  }, [responses]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subtasksData, responsesData] = await Promise.all([
        TRService.getSubtasks(taskId),
        TRSharedService.getTaskResponses(taskId)
      ]);

      setSubtasks(subtasksData);
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  };

  const loadResponses = async () => {
    try {
      const responsesData = await TRSharedService.getTaskResponses(taskId);
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  // OPTIMISTIC: Update both server & UI immediately
  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    // Update local optimistic state instantly
    setOptimisticCompleted(prev => ({ ...prev, [subtaskId]: completed }));
    try {
      await TRSharedService.markSubtaskCompleted(taskId, subtaskId, visitorName, completed);
      if (!completed) {
        toast.success('Subtask marked incomplete');
      } else {
        toast.success('Subtask completed!');
      }
    } catch (error) {
      // If error, revert the local optimistic update
      setOptimisticCompleted(prev => {
        const clone = { ...prev };
        delete clone[subtaskId];
        return clone;
      });
      console.error('Error toggling subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  // Prefer optimistic state for "me"; fallback to server truth if not present
  const isSubtaskCompletedByMe = (subtaskId: string): boolean => {
    if (optimisticCompleted.hasOwnProperty(subtaskId)) {
      return optimisticCompleted[subtaskId];
    }
    return responses.some(
      r =>
        r.subtask_id === subtaskId &&
        r.visitor_name === visitorName &&
        r.response_type === 'completion' &&
        r.is_completed
    );
  };

  // Server state for overall/others
  const isSubtaskCompletedByAnyone = (subtaskId: string): boolean => {
    return responses.some(
      r => r.subtask_id === subtaskId && r.response_type === 'completion' && r.is_completed
    );
  };

  const getSubtaskCompletedBy = (subtaskId: string): string[] => {
    return responses
      .filter(r => r.subtask_id === subtaskId && r.response_type === 'completion' && r.is_completed)
      .map(r => r.visitor_name)
      .filter((name, index, array) => array.indexOf(name) === index);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading subtasks...</div>;
  }

  if (subtasks.length === 0) {
    return <div className="text-sm text-muted-foreground">No subtasks</div>;
  }

  const myCompletedCount = subtasks.filter(s => isSubtaskCompletedByMe(s.id)).length;
  const totalCompletedCount = subtasks.filter(s => isSubtaskCompletedByAnyone(s.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Subtasks ({subtasks.length})</div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Overall: {totalCompletedCount} of {subtasks.length}
          </Badge>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            You: {myCompletedCount} of {subtasks.length}
          </div>
        </div>
      </div>

      <ScrollArea className="h-[300px] w-full rounded-md border">
        <div className="p-3 space-y-2">
          {subtasks.map((subtask) => {
            // Prefer optimistic result if available, otherwise use backend data
            const isCompletedByMe = isSubtaskCompletedByMe(subtask.id);
            const isCompletedByAnyone = isSubtaskCompletedByAnyone(subtask.id);
            const completedBy = getSubtaskCompletedBy(subtask.id);

            return (
              <div key={subtask.id} className="space-y-2">
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                    isCompletedByMe
                      ? 'bg-green-50 border-green-200'
                      : isCompletedByAnyone
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-card border-border'
                  }`}
                  onClick={() => handleToggleSubtask(subtask.id, !isCompletedByMe)}
                >
                  <Checkbox
                    checked={isCompletedByMe}
                    onCheckedChange={(checked) => handleToggleSubtask(subtask.id, checked as boolean)}
                  />

                  <span
                    className={`flex-1 text-sm ${
                      isCompletedByMe || (isCompletedByAnyone && !optimisticCompleted.hasOwnProperty(subtask.id))
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {subtask.title}
                  </span>

                  {(isCompletedByMe ||
                    (isCompletedByAnyone && !optimisticCompleted.hasOwnProperty(subtask.id))) &&
                    !isCompletedByMe && (
                      <Badge variant="secondary" className="text-xs">
                        Completed
                      </Badge>
                    )}
                </div>

                {completedBy.length > 0 && (
                  <div className="ml-7 flex items-center gap-1 text-xs text-green-600">
                    <User className="h-3 w-3" />
                    <span>Completed by: {completedBy.join(', ')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
