
import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, AlertTriangle } from 'lucide-react';
import { TRService, TRTask } from '@/services/trService';
import { PriorityBadge } from '@/components/tr/PriorityBadge';
import { StatusBadge } from '@/components/tr/StatusBadge';
import { SubtaskManager } from '@/components/tr/SubtaskManager';
import { format, isAfter, parseISO } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';

export default function SharedTask() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { language } = useTheme();
  const [task, setTask] = useState<TRTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareLink) {
      loadSharedTask();
    }
  }, [shareLink]);

  const loadSharedTask = async () => {
    try {
      setLoading(true);
      const sharedTask = await TRService.getSharedTask(shareLink!);
      if (sharedTask) {
        setTask(sharedTask);
      } else {
        setError('Task not found or no longer shared');
      }
    } catch (error) {
      console.error('Error loading shared task:', error);
      setError('Failed to load shared task');
      toast.error('Failed to load shared task');
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

  if (!shareLink) {
    return <Navigate to="/tr" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading shared task...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Task Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || 'This task might have been removed or is no longer shared.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="h-4 w-4" />
              <span>Shared Task</span>
            </div>
            <h1 className="text-2xl font-bold">Shared Task View</h1>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <CardTitle className={task.completed ? 'line-through text-muted-foreground' : ''}>
                      {task.title}
                    </CardTitle>
                    <PriorityBadge priority={task.priority} />
                    <Badge variant="secondary" className="text-xs">
                      {t('sharedTask', language)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Due on {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                      {task.due_time && ` at ${task.due_time}`}
                    </span>
                  </div>

                  <div className="mt-2">
                    <StatusBadge completed={task.completed} isOverdue={isOverdue(task)} />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {task.description && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">{t('description', language)}</h3>
                  <p className="text-muted-foreground">{task.description}</p>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-medium mb-3">{t('subtasks', language)}</h3>
                <SubtaskManager 
                  taskId={task.id} 
                  onSubtasksChange={() => {}}
                  readOnly={true}
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Created on {format(parseISO(task.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
