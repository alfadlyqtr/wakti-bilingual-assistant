
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { format, isPast, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, Circle, Calendar, Clock, 
  Share2, AlertTriangle, User, Users,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { MyTask, Subtask } from '@/contexts/MyTasksContext';

const SharedTask: React.FC = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const { user } = useAuth();
  const { language } = useTheme();
  
  const [task, setTask] = useState<MyTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shortId) {
      fetchSharedTask();
    }
  }, [shortId]);

  const fetchSharedTask = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('my_tasks')
        .select('*')
        .eq('short_id', shortId)
        .eq('is_shared', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError(t('taskNotFound', language));
        } else {
          throw fetchError;
        }
        return;
      }

      setTask({
        ...data,
        subtasks: data.subtasks || []
      });
    } catch (err: any) {
      console.error('Error fetching shared task:', err);
      setError(t('errorLoadingTask', language));
    } finally {
      setLoading(false);
    }
  };

  const getCompletorName = () => {
    if (user) {
      return user.user_metadata?.display_name || user.email || t('user', language);
    }
    return guestName.trim() || t('guest', language);
  };

  const handleToggleTask = async () => {
    if (!task) return;
    
    if (!user && !guestName.trim()) {
      toast.error(t('enterNameToComplete', language));
      return;
    }

    setSubmitting(true);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      
      // Update task status
      const { error: updateError } = await supabase
        .from('my_tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Record the completion
      if (newStatus === 'completed') {
        const { error: recordError } = await supabase
          .from('shared_task_completions')
          .insert({
            task_id: task.id,
            completed_by_user_id: user?.id || null,
            completed_by_name: getCompletorName(),
            completion_type: 'task'
          });

        if (recordError) throw recordError;
      }

      setTask({ ...task, status: newStatus });
      toast.success(t(newStatus === 'completed' ? 'completed' : 'pending', language));
    } catch (err: any) {
      console.error('Error updating task:', err);
      toast.error(t('errorUpdatingTask', language));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!task) return;
    
    if (!user && !guestName.trim()) {
      toast.error(t('enterNameToComplete', language));
      return;
    }

    setSubmitting(true);
    try {
      const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
      const subtask = task.subtasks[subtaskIndex];
      
      const updatedSubtasks = task.subtasks.map(s =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );

      // Update subtasks
      const { error: updateError } = await supabase
        .from('my_tasks')
        .update({ subtasks: updatedSubtasks })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Record the completion
      if (!subtask.completed) {
        const { error: recordError } = await supabase
          .from('shared_task_completions')
          .insert({
            task_id: task.id,
            completed_by_user_id: user?.id || null,
            completed_by_name: getCompletorName(),
            completion_type: 'subtask',
            subtask_index: subtaskIndex
          });

        if (recordError) throw recordError;
      }

      setTask({ ...task, subtasks: updatedSubtasks });
      toast.success(t('taskUpdatedSuccessfully', language));
    } catch (err: any) {
      console.error('Error updating subtask:', err);
      toast.error(t('errorUpdatingTask', language));
    } finally {
      setSubmitting(false);
    }
  };

  const getDueDateDisplay = () => {
    if (!task?.due_date) return null;
    
    const dueDate = new Date(task.due_date);
    const isOverdue = isPast(dueDate) && task.status !== 'completed';
    const isDueToday = isToday(dueDate);
    
    let variant: "default" | "secondary" | "destructive" = "default";
    if (isOverdue) variant = "destructive";
    else if (isDueToday) variant = "secondary";
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {format(dueDate, 'MMM d, h:mm a')}
      </Badge>
    );
  };

  const priorityColors = {
    normal: 'border-l-blue-500',
    urgent: 'border-l-orange-500',
    high: 'border-l-red-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t('loading', language)}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-semibold mb-2">{t('error', language)}</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!task) return null;

  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Share2 className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">{t('sharedTask', language)}</span>
            </div>
            <CardTitle>{t('dashboard', language)}</CardTitle>
          </CardHeader>
        </Card>

        {/* Guest Name Input (if not logged in) */}
        {!user && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('yourName', language)}
                </label>
                <Input
                  placeholder={t('enterYourName', language)}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('nameRequiredToComplete', language)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Card */}
        <Card className={`border-l-4 ${priorityColors[task.priority]}`}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <button
                onClick={handleToggleTask}
                disabled={submitting}
                className="flex-shrink-0 mt-1"
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <div className="flex-1 space-y-2">
                <h2 className={`text-lg font-semibold ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h2>
                
                {task.description && (
                  <p className={`text-sm text-muted-foreground ${task.status === 'completed' ? 'line-through' : ''}`}>
                    {task.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {getDueDateDisplay()}
                  
                  {task.task_type === 'task' && (
                    <Badge variant="outline">
                      {t(task.priority, language)} {t('priority', language)}
                    </Badge>
                  )}
                  
                  {task.status === 'completed' && (
                    <Badge className="bg-green-600">
                      ✅ {t('completed', language)}
                    </Badge>
                  )}
                  
                  {task.status === 'overdue' && (
                    <Badge variant="destructive">
                      ⚠️ {t('overdue', language)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Subtasks */}
            {task.subtasks.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('subtasks', language)}: {completedSubtasks}/{totalSubtasks}
                </div>
                <div className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSubtask(subtask.id)}
                        disabled={submitting}
                        className="flex-shrink-0"
                      >
                        {subtask.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <span className={`text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={handleToggleTask}
              disabled={submitting || (!user && !guestName.trim())}
              className="w-full"
              variant={task.status === 'completed' ? 'outline' : 'default'}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : task.status === 'completed' ? (
                <Circle className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {t(task.status === 'completed' ? 'markIncomplete' : 'markComplete', language)}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          {t('poweredBy', language)} {t('dashboard', language)}
        </div>
      </div>
    </div>
  );
};

export default SharedTask;
