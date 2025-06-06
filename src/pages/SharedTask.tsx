import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, AlertTriangle, CheckCircle, XCircle, Pause } from 'lucide-react';
import { TRService, TRTask } from '@/services/trService';
import { TRSharedService, TRVisitorCompletion } from '@/services/trSharedService';
import { PriorityBadge } from '@/components/tr/PriorityBadge';
import { StatusBadge } from '@/components/tr/StatusBadge';
import { InteractiveSubtaskManager } from '@/components/tr/InteractiveSubtaskManager';
import { EnhancedVisitorNameModal } from '@/components/tr/EnhancedVisitorNameModal';
import { SnoozeRequestModal } from '@/components/tr/SnoozeRequestModal';
import { LiveVisitorIndicator } from '@/components/tr/LiveVisitorIndicator';
import { VisitorIdentityService, VisitorIdentity } from '@/services/visitorIdentityService';
import { format, isAfter, parseISO } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { TaskComments } from '@/components/tr/TaskComments';

export default function SharedTask() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { language } = useTheme();
  const [task, setTask] = useState<TRTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Visitor state - using new identity system
  const [visitorIdentity, setVisitorIdentity] = useState<VisitorIdentity | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [visitorAuthChecked, setVisitorAuthChecked] = useState(false);
  
  // Task interaction state
  const [taskCompletion, setTaskCompletion] = useState<TRVisitorCompletion | null>(null);
  const [completions, setCompletions] = useState<TRVisitorCompletion[]>([]);

  // Check visitor authentication with enhanced system
  useEffect(() => {
    if (shareLink && !visitorAuthChecked && task) {
      console.log('Checking visitor auth for shareLink:', shareLink);
      checkVisitorAuth();
      setVisitorAuthChecked(true);
    }
  }, [shareLink, visitorAuthChecked, task]);

  const checkVisitorAuth = async () => {
    if (!task) return;
    
    const storedIdentity = await VisitorIdentityService.getStoredIdentity(task.id);
    
    if (storedIdentity) {
      console.log('Found stored visitor identity:', storedIdentity.name);
      setVisitorIdentity(storedIdentity);
      await recordVisitorAccess(storedIdentity);
    } else {
      console.log('No stored visitor identity, showing name modal');
      setShowNameModal(true);
    }
  };

  useEffect(() => {
    if (shareLink) {
      loadSharedTask();
    }
  }, [shareLink]);

  useEffect(() => {
    if (task && visitorIdentity && !showNameModal) {
      loadTaskCompletions();
      
      // Set up real-time subscription
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, () => {
        loadTaskCompletions();
      });

      // Update visitor activity periodically
      const activityInterval = setInterval(() => {
        TRSharedService.updateVisitorActivity(visitorIdentity.sessionId, true);
        VisitorIdentityService.updateLastActive(task.id, visitorIdentity);
      }, 30000); // Every 30 seconds

      // Mark visitor as inactive when leaving
      const handleBeforeUnload = () => {
        TRSharedService.updateVisitorActivity(visitorIdentity.sessionId, false);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        channel.unsubscribe();
        clearInterval(activityInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        TRSharedService.updateVisitorActivity(visitorIdentity.sessionId, false);
      };
    }
  }, [task, visitorIdentity, showNameModal]);

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

  const loadTaskCompletions = async () => {
    if (!task || !visitorIdentity) return;

    try {
      const [allCompletions, myTaskCompletion] = await Promise.all([
        TRSharedService.getVisitorCompletions(task.id),
        TRSharedService.getVisitorCompletion(task.id, visitorIdentity.sessionId)
      ]);
      
      setCompletions(allCompletions);
      setTaskCompletion(myTaskCompletion);
    } catch (error) {
      console.error('Error loading completions:', error);
    }
  };

  const recordVisitorAccess = async (identity: VisitorIdentity) => {
    if (!task) return;

    try {
      await TRSharedService.recordVisitorAccess(task.id, identity.name, identity.sessionId);
    } catch (error) {
      console.error('Error recording visitor access:', error);
    }
  };

  const handleIdentitySubmit = async (identity: VisitorIdentity) => {
    console.log('Submitting visitor identity:', identity.name);
    
    setVisitorIdentity(identity);
    setShowNameModal(false);
    
    await recordVisitorAccess(identity);
    toast.success(`Welcome, ${identity.name}!`);
  };

  const handleTaskToggle = async (completed: boolean) => {
    if (!task || !visitorIdentity) return;

    try {
      await TRSharedService.markTaskCompleted(task.id, visitorIdentity.name, visitorIdentity.sessionId, completed);
      
      // Update local state optimistically
      if (completed) {
        const newCompletion: TRVisitorCompletion = {
          id: `temp-${Date.now()}`,
          task_id: task.id,
          visitor_name: visitorIdentity.name,
          session_id: visitorIdentity.sessionId,
          completion_type: 'task',
          is_completed: completed,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setTaskCompletion(newCompletion);
      } else {
        setTaskCompletion(null);
      }

      toast.success(completed ? 'Task marked as complete' : 'Task marked as incomplete');
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleSnoozeRequest = async (reason?: string) => {
    if (!task || !visitorIdentity) return;

    try {
      await TRSharedService.requestSnooze(task.id, visitorIdentity.name, visitorIdentity.sessionId, reason);
      toast.success('Snooze request sent to task owner');
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

  const getTaskCompletedBy = (): string[] => {
    return completions
      .filter(c => c.completion_type === 'task' && c.is_completed && !c.subtask_id)
      .map(c => c.visitor_name)
      .filter((name, index, array) => array.indexOf(name) === index); // Remove duplicates
  };

  if (!shareLink) {
    return <Navigate to="/tr" replace />;
  }

  if (loading) {
    return (
      <div 
        className="fixed inset-0 w-full h-full bg-background overflow-y-auto"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading shared task...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div 
        className="fixed inset-0 w-full h-full bg-background overflow-y-auto"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div className="flex items-center justify-center min-h-full p-4">
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
      </div>
    );
  }

  const taskCompletedBy = getTaskCompletedBy();
  const isTaskCompleted = taskCompletion?.is_completed || false;

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-background"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      <div 
        className="w-full h-full overflow-y-auto overflow-x-hidden"
        style={{
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div className="min-h-full">
          <div className="w-full max-w-none mx-auto px-4 py-6 sm:max-w-2xl lg:max-w-4xl">
            <div className="space-y-6">
              {/* Header Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Shared Task • {visitorIdentity?.name || 'Loading...'}</span>
                  </div>
                  {visitorIdentity && (
                    <LiveVisitorIndicator taskId={task.id} currentSessionId={visitorIdentity.sessionId} />
                  )}
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
                      {isTaskCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm">
                        {isTaskCompleted ? 'You marked this task as complete' : 'Mark this task as complete'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        variant={isTaskCompleted ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleTaskToggle(!isTaskCompleted)}
                        className="flex-1 w-full"
                      >
                        {isTaskCompleted ? 'Mark Incomplete' : 'Mark Complete'}
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

                  {/* Interactive Subtasks */}
                  {visitorIdentity && (
                    <div>
                      <InteractiveSubtaskManager 
                        taskId={task.id}
                        visitorName={visitorIdentity.name}
                        sessionId={visitorIdentity.sessionId}
                      />
                    </div>
                  )}

                  {/* Comments Section */}
                  {visitorIdentity && (
                    <div className="border-t pt-6">
                      <TaskComments
                        taskId={task.id}
                        visitorName={visitorIdentity.name}
                        sessionId={visitorIdentity.sessionId}
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
        </div>
      </div>

      {/* Modals */}
      {task && (
        <EnhancedVisitorNameModal
          isOpen={showNameModal}
          onSubmit={handleIdentitySubmit}
          taskTitle={task.title}
          taskId={task.id}
        />
      )}

      {task && (
        <SnoozeRequestModal
          isOpen={showSnoozeModal}
          onClose={() => setShowSnoozeModal(false)}
          onSubmit={handleSnoozeRequest}
          taskTitle={task.title}
        />
      )}
    </div>
  );
}
