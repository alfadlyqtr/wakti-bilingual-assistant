
import React, { useState, useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TRService, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { toast } from 'sonner';
import { CheckCircle, User, Users, XCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

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
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, () => {
      // Small debounce to coalesce bursts
      setTimeout(() => {
        if (isMounted.current) {
          loadData();
        }
      }, 150);
    });
    return () => {
      isMounted.current = false;
      channel.unsubscribe();
    };
  }, [taskId]);

  // Reconcile optimistic state against server truth on any response/subtask change.
  // We clear any optimistic entries so UI reflects backend immediately (prevents stale 'You' counts).
  useEffect(() => {
    if (Object.keys(optimisticCompleted).length === 0) return;
    setOptimisticCompleted({});
    // eslint-disable-next-line
  }, [responses, subtasks]);

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
  const handleToggleSubtask = async (subtask: TRSubtask, completed: boolean) => {
    // Rule: Only owner can uncheck once subtask is completed (owner state)
    if (!completed && subtask.completed) {
      try {
        await TRSharedService.requestUncheck(taskId, subtask.id, visitorName);
        toast.success('Request to uncheck sent to owner');
      } catch (e) {
        console.error(e);
        toast.error('Failed to send uncheck request');
      }
      return; // do not modify local optimistic state
    }

    // Normal toggle flow (completion from assignee)
    setOptimisticCompleted(prev => ({ ...prev, [subtask.id]: completed }));
    try {
      await TRSharedService.markSubtaskCompleted(taskId, subtask.id, visitorName, completed);
      toast.success(completed ? 'Subtask completed!' : 'Subtask marked incomplete');
    } catch (error) {
      setOptimisticCompleted(prev => {
        const clone = { ...prev };
        delete clone[subtask.id];
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

  // Overall completion should follow owner truth only
  const isSubtaskCompletedByAnyone = (subtaskId: string): boolean => {
    const st = subtasks.find(s => s.id === subtaskId);
    return !!st?.completed;
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

  // Count 'You' only when the owner also has the subtask completed
  const myCompletedCount = subtasks.filter(s => s.completed && isSubtaskCompletedByMe(s.id)).length;
  const totalCompletedCount = subtasks.filter(s => s.completed).length;

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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => loadData()}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[300px] w-full rounded-md border">
        <div className="p-3 space-y-2">
          {subtasks.map((subtask) => {
            // Personal completion state (optimistic-aware)
            const isCompletedByMe = isSubtaskCompletedByMe(subtask.id);
            // Owner is the source of truth for overall/lock state
            const ownerCompleted = !!subtask.completed;
            const completedBy = getSubtaskCompletedBy(subtask.id);

            return (
              <div key={subtask.id} className="space-y-2">
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                    ownerCompleted && isCompletedByMe
                      ? 'bg-green-50 border-green-200'
                      : ownerCompleted
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-card border-border'
                  }`}
                  onClick={() => handleToggleSubtask(subtask, !isCompletedByMe)}
                >
                  <Checkbox
                    checked={isCompletedByMe}
                    onCheckedChange={(checked) => handleToggleSubtask(subtask, !!checked)}
                  />

                  <span
                    className={`flex-1 text-sm ${
                      ownerCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {subtask.title}
                  </span>

                  {subtask.due_date && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                        ownerCompleted ? 'text-muted-foreground border-muted-foreground/30' : 'text-foreground/80 border-border'
                      }`}
                      title="Due date"
                    >
                      {format(new Date(subtask.due_date), 'MMM d')}
                      {subtask.due_time ? ` ${subtask.due_time}` : ''}
                    </span>
                  )}

                  {ownerCompleted && (
                    <div className="flex items-center gap-2">
                      {!isCompletedByMe && (
                        <Badge variant="secondary" className="text-xs">
                          Completed
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await TRSharedService.requestUncheck(taskId, subtask.id, visitorName);
                            toast.success('Uncheck request sent to owner');
                          } catch (err) {
                            console.error(err);
                            toast.error('Failed to send uncheck request');
                          }
                        }}
                        title="Request owner to uncheck"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Request uncheck
                      </Button>
                    </div>
                  )}
                </div>

                {ownerCompleted && completedBy.length > 0 && (
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
