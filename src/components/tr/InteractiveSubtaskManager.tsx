
import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TRService, TRSubtask } from '@/services/trService';
import { TRSharedService, TRVisitorCompletion } from '@/services/trSharedService';
import { toast } from 'sonner';
import { CheckCircle, User } from 'lucide-react';

interface InteractiveSubtaskManagerProps {
  taskId: string;
  visitorName: string;
  sessionId: string;
  readOnly?: boolean;
}

export const InteractiveSubtaskManager: React.FC<InteractiveSubtaskManagerProps> = ({
  taskId,
  visitorName,
  sessionId,
  readOnly = false
}) => {
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [completions, setCompletions] = useState<TRVisitorCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingSubtasks, setUpdatingSubtasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    
    // Set up real-time subscription for subtask completions
    const channel = TRSharedService.subscribeToTaskUpdates(taskId, () => {
      loadCompletions();
    });

    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subtasksData, completionsData] = await Promise.all([
        TRService.getSubtasks(taskId),
        TRSharedService.getVisitorCompletions(taskId)
      ]);
      
      setSubtasks(subtasksData);
      setCompletions(completionsData);
    } catch (error) {
      console.error('Error loading subtask data:', error);
      toast.error('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  };

  const loadCompletions = async () => {
    try {
      const completionsData = await TRSharedService.getVisitorCompletions(taskId);
      setCompletions(completionsData);
    } catch (error) {
      console.error('Error loading completions:', error);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (readOnly || updatingSubtasks.has(subtaskId)) return;

    // Add optimistic update
    setUpdatingSubtasks(prev => new Set(prev).add(subtaskId));

    try {
      await TRSharedService.markSubtaskCompleted(taskId, subtaskId, visitorName, sessionId, completed);
      
      // Update local completions state optimistically
      const existingIndex = completions.findIndex(
        c => c.subtask_id === subtaskId && c.session_id === sessionId
      );

      if (existingIndex >= 0) {
        const updatedCompletions = [...completions];
        updatedCompletions[existingIndex] = {
          ...updatedCompletions[existingIndex],
          is_completed: completed
        };
        setCompletions(updatedCompletions);
      } else if (completed) {
        const newCompletion: TRVisitorCompletion = {
          id: `temp-${Date.now()}`,
          task_id: taskId,
          subtask_id: subtaskId,
          visitor_name: visitorName,
          session_id: sessionId,
          completion_type: 'subtask',
          is_completed: completed,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setCompletions([...completions, newCompletion]);
      }

      toast.success(completed ? 'Subtask completed!' : 'Subtask marked incomplete');
    } catch (error) {
      console.error('Error toggling subtask:', error);
      toast.error('Failed to update subtask');
      // Revert optimistic update on error
      loadCompletions();
    } finally {
      setUpdatingSubtasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(subtaskId);
        return newSet;
      });
    }
  };

  const isSubtaskCompleted = (subtaskId: string): boolean => {
    const completion = completions.find(
      c => c.subtask_id === subtaskId && c.session_id === sessionId && c.completion_type === 'subtask'
    );
    return completion?.is_completed || false;
  };

  const getSubtaskCompletedBy = (subtaskId: string): string[] => {
    return completions
      .filter(c => c.subtask_id === subtaskId && c.is_completed && c.completion_type === 'subtask')
      .map(c => c.visitor_name);
  };

  const getTotalCompletions = (subtaskId: string): number => {
    return completions.filter(
      c => c.subtask_id === subtaskId && c.is_completed && c.completion_type === 'subtask'
    ).length;
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading subtasks...</div>;
  }

  if (subtasks.length === 0) {
    return <div className="text-sm text-muted-foreground">No subtasks</div>;
  }

  // Separate completed and pending subtasks
  const pendingSubtasks = subtasks.filter(subtask => !isSubtaskCompleted(subtask.id));
  const completedSubtasks = subtasks.filter(subtask => isSubtaskCompleted(subtask.id));
  const completedCount = subtasks.filter(subtask => getTotalCompletions(subtask.id) > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Subtasks ({subtasks.length})</div>
        {completedCount > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {completedCount} of {subtasks.length} completed
          </div>
        )}
      </div>
      
      {/* Pending Subtasks */}
      {pendingSubtasks.map((subtask) => {
        const isCompleted = isSubtaskCompleted(subtask.id);
        const completedBy = getSubtaskCompletedBy(subtask.id);
        const isUpdating = updatingSubtasks.has(subtask.id);
        
        return (
          <div 
            key={subtask.id} 
            className={`group relative transition-all duration-200 ${
              isUpdating ? 'opacity-50' : ''
            }`}
          >
            <div 
              className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                isCompleted 
                  ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                  : 'bg-secondary/20 border-secondary hover:bg-secondary/30'
              } ${!readOnly ? 'hover:shadow-sm' : ''}`}
              onClick={() => !readOnly && !isUpdating && handleToggleSubtask(subtask.id, !isCompleted)}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={(checked) => !readOnly && !isUpdating && handleToggleSubtask(subtask.id, checked as boolean)}
                  disabled={readOnly || isUpdating}
                  className="transition-all duration-200"
                />
                
                <span className={`flex-1 text-sm transition-all duration-200 ${
                  isCompleted 
                    ? 'line-through text-muted-foreground font-medium' 
                    : 'text-foreground'
                }`}>
                  {subtask.title}
                </span>

                {isUpdating && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              
              {completedBy.length > 0 && (
                <div className="ml-7 flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 text-green-600">
                    <User className="h-3 w-3" />
                    <span className="font-medium">
                      Completed by: {completedBy.join(', ')}
                    </span>
                  </div>
                  {completedBy.length > 1 && (
                    <span className="text-muted-foreground">
                      ({completedBy.length} people)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Completed Subtasks Section */}
      {completedSubtasks.length > 0 && (
        <>
          <div className="border-t pt-3 mt-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Completed Subtasks ({completedSubtasks.length})
            </div>
            {completedSubtasks.map((subtask) => {
              const completedBy = getSubtaskCompletedBy(subtask.id);
              const isUpdating = updatingSubtasks.has(subtask.id);
              
              return (
                <div 
                  key={subtask.id} 
                  className={`group relative transition-all duration-200 mb-2 ${
                    isUpdating ? 'opacity-50' : ''
                  }`}
                >
                  <div 
                    className="flex flex-col gap-2 p-3 rounded-lg bg-green-50 border border-green-200 cursor-pointer transition-all duration-200 hover:bg-green-100"
                    onClick={() => !readOnly && !isUpdating && handleToggleSubtask(subtask.id, false)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => !readOnly && !isUpdating && handleToggleSubtask(subtask.id, false)}
                        disabled={readOnly || isUpdating}
                        className="transition-all duration-200"
                      />
                      
                      <span className="flex-1 text-sm line-through text-muted-foreground font-medium">
                        {subtask.title}
                      </span>

                      {isUpdating && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    
                    <div className="ml-7 flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 text-green-600">
                        <User className="h-3 w-3" />
                        <span className="font-medium">
                          Completed by: {completedBy.join(', ')}
                        </span>
                      </div>
                      {completedBy.length > 1 && (
                        <span className="text-muted-foreground">
                          ({completedBy.length} people)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
