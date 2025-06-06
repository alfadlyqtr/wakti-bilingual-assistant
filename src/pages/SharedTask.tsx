
import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, User, AlertTriangle, CheckCircle, XCircle, Pause } from 'lucide-react';
import { TRService, TRTask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { PriorityBadge } from '@/components/tr/PriorityBadge';
import { StatusBadge } from '@/components/tr/StatusBadge';
import { SimpleSubtaskManager } from '@/components/tr/SimpleSubtaskManager';
import { SimpleVisitorModal } from '@/components/tr/SimpleVisitorModal';
import { SimpleComments } from '@/components/tr/SimpleComments';
import { VisitorIdentityService } from '@/services/visitorIdentityService';
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
  
  // Simple visitor state
  const [visitorName, setVisitorName] = useState<string>('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState('');
  
  // Responses
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);

  useEffect(() => {
    if (shareLink) {
      loadSharedTask();
    }
  }, [shareLink]);

  useEffect(() => {
    if (task) {
      // Check for stored visitor name using the correct task ID
      const storedName = VisitorIdentityService.getStoredName(task.id);
      console.log('Stored name for task', task.id, ':', storedName);
      
      if (storedName) {
        setVisitorName(storedName);
        // Don't show name modal if we have a stored name
        setShowNameModal(false);
      } else {
        // Show name modal if no stored name
        setShowNameModal(true);
      }
    }
  }, [task]);

  useEffect(() => {
    if (task && visitorName) {
      loadResponses();
      
      // Real-time subscription
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, loadResponses);
      return () => {
        channel.unsubscribe();
      };
    }
  }, [task, visitorName]);

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

  const loadResponses = async () => {
    if (!task) return;
    
    try {
      const responsesData = await TRSharedService.getTaskResponses(task.id);
      console.log('Loaded responses:', responsesData);
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  const handleNameSubmit = (name: string) => {
    if (task) {
      // Store the name using the task ID
      VisitorIdentityService.storeName(task.id, name);
      console.log('Stored name for task', task.id, ':', name);
    }
    setVisitorName(name);
    setShowNameModal(false);
    toast.success(`Welcome, ${name}!`);
  };

  const handleTaskToggle = async (completed: boolean) => {
    if (!task || !visitorName) return;

    try {
      await TRSharedService.markTaskCompleted(task.id, visitorName, completed);
      toast.success(completed ? 'Task marked as complete' : 'Task marked as incomplete');
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleSnoozeRequest = async () => {
    if (!task || !visitorName) return;

    try {
      await TRSharedService.requestSnooze(task.id, visitorName, snoozeReason.trim() || undefined);
      setShowSnoozeModal(false);
      setSnoozeReason('');
      toast.success('Snooze request sent');
    } catch (error) {
      console.error('Error requesting snooze:', error);
      toast.error('Failed to send snooze request');
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

  // Check if I completed the task
  const isTaskCompletedByMe = responses.some(
    r => r.visitor_name === visitorName && 
        r.response_type === 'completion' && 
        r.is_completed && 
        !r.subtask_id
  );

  // Get who completed the task
  const taskCompletedBy = responses
    .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
    .map(r => r.visitor_name)
    .filter((name, index, array) => array.indexOf(name) === index);

  if (!shareLink) {
    return <Navigate to="/tr" replace />;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 w-full h-full bg-background overflow-y-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading shared task...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 w-full h-full bg-background overflow-y-auto flex items-center justify-center">
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
    <div className="fixed inset-0 w-full h-full bg-background overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Shared Task • {visitorName || 'Loading...'}</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold">Interactive Task View</h1>
          </div>

          {/* Main Task Card */}
          <Card className="w-full">
            <CardHeader className="pb-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className={`text-lg leading-tight break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </CardTitle>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={task.priority} />
                  <Badge variant="secondary" className="text-xs">
                    {t('sharedTask', language)}
                  </Badge>
                  <StatusBadge completed={task.completed} isOverdue={task.due_date ? isOverdue(task) : false} />
                </div>
                
                {task.due_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      Due on {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                      {task.due_time && ` at ${task.due_time}`}
                    </span>
                  </div>
                )}

                {taskCompletedBy.length > 0 && (
                  <Badge variant="outline" className="text-xs w-fit">
                    ✓ Completed by: {taskCompletedBy.join(', ')}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="font-medium mb-2">{t('description', language)}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed break-words">{task.description}</p>
                </div>
              )}

              {/* Task Completion Actions */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {isTaskCompletedByMe ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm">
                    {isTaskCompletedByMe ? 'You marked this task as complete' : 'Mark this task as complete'}
                  </span>
                </div>
                
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant={isTaskCompletedByMe ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleTaskToggle(!isTaskCompletedByMe)}
                    className="flex-1 w-full"
                  >
                    {isTaskCompletedByMe ? 'Mark Incomplete' : 'Mark Complete'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSnoozeModal(true)}
                    className="flex-1 w-full sm:flex-initial sm:min-w-[140px]"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Request Snooze
                  </Button>
                </div>
              </div>

              {/* Subtasks */}
              {visitorName && (
                <SimpleSubtaskManager 
                  taskId={task.id}
                  visitorName={visitorName}
                />
              )}

              {/* Comments */}
              {visitorName && (
                <div className="border-t pt-6">
                  <SimpleComments
                    taskId={task.id}
                    visitorName={visitorName}
                    responses={responses}
                  />
                </div>
              )}

              {/* Footer Info */}
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

      {/* Simple Visitor Name Modal */}
      {task && (
        <SimpleVisitorModal
          isOpen={showNameModal}
          onSubmit={handleNameSubmit}
          taskTitle={task.title}
        />
      )}

      {/* Simple Snooze Modal */}
      <Dialog open={showSnoozeModal} onOpenChange={setShowSnoozeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5" />
              Request Snooze
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Request to snooze task:
              </p>
              <p className="font-semibold text-primary">"{task.title}"</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={snoozeReason}
                onChange={(e) => setSnoozeReason(e.target.value)}
                placeholder="Why do you need more time?"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSnoozeRequest} className="flex-1">
                Send Request
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowSnoozeModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
