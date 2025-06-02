
import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TRService, TRSubtask } from '@/services/trService';
import { TRSharedService, TRVisitorCompletion } from '@/services/trSharedService';
import { toast } from 'sonner';

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

  useEffect(() => {
    loadData();
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

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (readOnly) return;

    try {
      await TRSharedService.markSubtaskCompleted(taskId, subtaskId, visitorName, sessionId, completed);
      
      // Update local completions state
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
      } else {
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

      toast.success(completed ? 'Subtask marked as complete' : 'Subtask marked as incomplete');
    } catch (error) {
      console.error('Error toggling subtask:', error);
      toast.error('Failed to update subtask');
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading subtasks...</div>;
  }

  if (subtasks.length === 0) {
    return <div className="text-sm text-muted-foreground">No subtasks</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Subtasks ({subtasks.length})</div>
      
      {subtasks.map((subtask) => {
        const isCompleted = isSubtaskCompleted(subtask.id);
        const completedBy = getSubtaskCompletedBy(subtask.id);
        
        return (
          <div key={subtask.id} className="flex flex-col gap-2 p-3 bg-secondary/20 rounded-md">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isCompleted}
                onCheckedChange={(checked) => handleToggleSubtask(subtask.id, checked as boolean)}
                disabled={readOnly}
              />
              
              <span className={`flex-1 text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                {subtask.title}
              </span>
            </div>
            
            {completedBy.length > 0 && (
              <div className="ml-6 text-xs text-muted-foreground">
                ✓ Completed by: {completedBy.join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
