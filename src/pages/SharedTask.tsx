
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Clock, Users } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask, TRSharedAccess } from '@/services/trService';
import { PriorityBadge } from '@/components/tr/PriorityBadge';
import { StatusBadge } from '@/components/tr/StatusBadge';
import { SubtaskManager } from '@/components/tr/SubtaskManager';
import { toast } from 'sonner';
import { format, parseISO, isAfter } from 'date-fns';

export default function SharedTask() {
  const { shareId } = useParams<{ shareId: string }>();
  const { language } = useTheme();
  const [task, setTask] = useState<TRTask | null>(null);
  const [sharedAccess, setSharedAccess] = useState<TRSharedAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareId) {
      loadSharedTask();
    }
  }, [shareId]);

  const loadSharedTask = async () => {
    if (!shareId) return;
    
    setLoading(true);
    try {
      const taskData = await TRService.getTaskByShareLink(shareId);
      if (!taskData) {
        setError('Task not found or no longer shared');
        return;
      }
      
      setTask(taskData);
      
      // Record access
      await TRService.recordSharedAccess(taskData.id);
      
      // Load shared access records
      const accessData = await TRService.getSharedAccess(taskData.id);
      setSharedAccess(accessData);
    } catch (error) {
      console.error('Error loading shared task:', error);
      setError('Error loading task');
    } finally {
      setLoading(false);
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

  const handleToggleComplete = async () => {
    if (!task) return;
    
    try {
      const updates: Partial<TRTask> = {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : undefined
      };
      
      const updatedTask = await TRService.updateTask(task.id, updates);
      setTask(updatedTask);
      toast.success(t(task.completed ? 'taskIncomplete' : 'taskCompleted', language));
    } catch (error) {
      console.error('Error toggling task completion:', error);
      toast.error('Error updating task');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Task Not Found</h1>
          <p className="text-muted-foreground">{error || 'This task is no longer available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t('sharedTask', language)}</h1>
          <p className="text-muted-foreground">View and interact with this shared task</p>
        </div>

        {/* Task Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleComplete}
                className="p-0 h-auto mt-1"
              >
                {task.completed ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </Button>
              
              <div className="flex-1">
                <CardTitle className={`${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </CardTitle>
                
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                    {task.due_time && ` at ${task.due_time}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge completed={task.completed} isOverdue={isOverdue(task)} />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {task.description && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">{t('description', language)}</h4>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
            )}

            {/* Subtasks */}
            <div className="mb-4">
              <SubtaskManager 
                taskId={task.id} 
                isShared={true}
                onSubtasksChange={() => {}}
              />
            </div>

            {/* Viewed By */}
            {sharedAccess.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('viewedBy', language)}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {sharedAccess.slice(0, 5).map((access) => (
                    <div key={access.id}>
                      {access.viewer_name || t('guest', language)} - {format(parseISO(access.last_accessed), 'MMM dd, HH:mm')}
                    </div>
                  ))}
                  {sharedAccess.length > 5 && (
                    <div>+{sharedAccess.length - 5} more</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleToggleComplete}
            variant={task.completed ? "outline" : "default"}
            className="flex-1"
          >
            {task.completed ? t('markIncomplete', language) : t('markComplete', language)}
          </Button>
        </div>
      </div>
    </div>
  );
}
