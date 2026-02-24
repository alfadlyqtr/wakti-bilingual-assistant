
import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, User, AlertTriangle, CheckCircle, XCircle, Pause, RefreshCw } from 'lucide-react';
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
import InAppWaktiEscape from '@/components/public/InAppWaktiEscape';
import { supabase } from '@/integrations/supabase/client';

export default function SharedTask() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { language } = useTheme();
  const navigate = useNavigate();
  const [task, setTask] = useState<TRTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  
  // Simple visitor state
  const [visitorName, setVisitorName] = useState<string>('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState('');
  
  // Responses
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);
  // People (unified)
  const [taskPeopleData, setTaskPeopleData] = useState<{ owner: { name: string; userId: string } | null; participants: { name: string; source: 'app' | 'link'; lastActivity: string | null }[] } | null>(null);

  // ── Wakti user detection ──
  // If the visitor is already logged into Wakti, redirect them into the app
  // so they interact from the Shared Tasks tab with their real identity.
  // Non-Wakti users (no session) continue to the public page unchanged.
  useEffect(() => {
    if (!shareLink) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Logged-in Wakti user — send them into the app
        navigate(`/tr?shared=${shareLink}`, { replace: true });
      }
      // No session → fall through to normal public page flow
    });
  }, [shareLink, navigate]);

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
    if (task) {
      loadPeople();
    }
  }, [task]);

  // Ensure visit ping exists for returning visitors (stored name)
  useEffect(() => {
    if (!task || !visitorName) return;
    (async () => {
      try {
        const { data: existing } = await supabase
          .from('tr_shared_responses')
          .select('id')
          .eq('task_id', task.id)
          .eq('visitor_name', visitorName)
          .eq('response_type', 'visit')
          .maybeSingle();
        if (!existing) {
          await supabase.from('tr_shared_responses').insert({
            task_id: task.id,
            visitor_name: visitorName,
            response_type: 'visit',
            is_completed: false,
          });
          // Reload people after ping inserted
          loadPeople();
        }
      } catch (_e) { /* non-critical */ }
    })();
  }, [task, visitorName]);

  useEffect(() => {
    if (task && visitorName) {
      loadResponses();
      loadPeople(); // Reload people whenever responses change context
      
      // Real-time subscription - reload both task and responses on any update
      const handleRealtimeUpdate = () => {
        loadSharedTask(false); // Reload task without loading spinner
        loadResponses();
        loadPeople();
      };
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, handleRealtimeUpdate);
      return () => {
        channel.unsubscribe();
      };
    }
  }, [task, visitorName]);

  const loadSharedTask = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
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
      setResponses(responsesData);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  const loadPeople = async () => {
    if (!task) return;
    try {
      const people = await TRSharedService.getTaskPeople(task.id);
      setTaskPeopleData(people);
    } catch (_e) { /* non-critical */ }
  };

  const handleManualRefresh = async () => {
    try {
      setManualRefreshing(true);
      await loadSharedTask();
      await loadResponses();
      await loadPeople();
    } finally {
      setManualRefreshing(false);
    }
  };

  const handleNameSubmit = async (name: string) => {
    if (task) {
      // Store the name using the task ID
      VisitorIdentityService.storeName(task.id, name);
      // Insert a visit ping so owner can see this person in the People tab immediately
      try {
        const { data: existing } = await supabase
          .from('tr_shared_responses')
          .select('id')
          .eq('task_id', task.id)
          .eq('visitor_name', name)
          .eq('response_type', 'visit')
          .maybeSingle();
        if (!existing) {
          await supabase.from('tr_shared_responses').insert({
            task_id: task.id,
            visitor_name: name,
            response_type: 'visit',
            is_completed: false,
          });
        }
      } catch (_e) { /* non-critical */ }
    }
    setVisitorName(name);
    setShowNameModal(false);
    toast.success(`Welcome, ${name}!`);
  };

  const handleRequestCompletion = async () => {
    if (!task || !visitorName) return;

    try {
      await TRSharedService.requestTaskCompletion(task.id, visitorName);
      toast.success('Completion request sent to task owner');
    } catch (error) {
      console.error('Error requesting completion:', error);
      toast.error('Failed to send completion request');
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

  // Check if I completed the task (for info only)
  const isTaskCompletedByMe = responses.some(
    r => r.visitor_name === visitorName &&
      r.response_type === 'completion' &&
      r.is_completed &&
      !r.subtask_id
  );
  const ownerCompleted = !!task?.completed; // owner truth (guard task may be null during refresh)

  // Check if there's a pending completion request from me
  const myPendingCompletionRequest = responses.find(
    r => r.visitor_name === visitorName &&
      r.response_type === 'completion_request' &&
      !r.content // no status means pending
  );
  const hasPendingRequest = !!myPendingCompletionRequest;

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
      <InAppWaktiEscape language={language === 'ar' ? 'ar' : 'en'} />
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Shared Task • {visitorName || 'Loading...'}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualRefresh}
                disabled={manualRefreshing}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${manualRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <h1 className="text-2xl font-bold">Interactive Task View</h1>
          </div>

          {/* Main Task Card */}
          <Card className="w-full relative">
            <CardHeader className="pb-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className={`text-lg leading-tight break-words ${task?.completed ? 'line-through text-muted-foreground' : ''}`}>
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

                {(() => {
                  const latest = responses
                    .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  if (!latest || !task.completed) return null;
                  const stamp = `${latest.visitor_name}${latest.created_at ? ` • ${format(parseISO(latest.created_at), 'MMM dd, HH:mm')}` : ''}`;
                  return (
                    <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                      ✓ Completed by: {stamp}
                    </Badge>
                  );
                })()}
              </div>
            </CardHeader>

            {/* Overlay when task is completed (assignee view locked) */}
            {ownerCompleted && (() => {
              const latest = responses
                .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
              const who = latest?.visitor_name || 'Someone';
              const when = latest?.created_at ? format(parseISO(latest.created_at), 'MMM dd, HH:mm') : '';
              return (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
                  <div className="relative z-10 px-6 py-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_0_3rem_rgba(16,185,129,0.35)] flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                    <div className="text-center">
                      <div className="font-semibold">Task completed</div>
                      <div className="text-xs">by {who}{when ? ` • ${when}` : ''}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <CardContent className={`space-y-6 ${ownerCompleted ? 'pointer-events-none' : ''}`}>
              {/* Description */}
              {task.description && (
                <div>
                  <h3 className="font-medium mb-2">{t('description', language)}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed break-words">{task.description}</p>
                </div>
              )}

              {/* Task Completion Actions (assignee requests completion, owner approves) */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {ownerCompleted ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : hasPendingRequest ? (
                    <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm">
                    {ownerCompleted 
                      ? 'Task is completed' 
                      : hasPendingRequest 
                        ? 'Completion request pending approval'
                        : 'Request task completion'}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant={ownerCompleted ? "secondary" : hasPendingRequest ? "outline" : "default"}
                    size="sm"
                    onClick={handleRequestCompletion}
                    disabled={ownerCompleted || hasPendingRequest}
                    className="flex-1 w-full"
                  >
                    {ownerCompleted 
                      ? 'Completed' 
                      : hasPendingRequest 
                        ? 'Request Pending...'
                        : 'Request Completion'}
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

              {/* People */}
              {visitorName && taskPeopleData && (() => {
                const ownerName = taskPeopleData.owner?.name || 'Owner';
                const participants = taskPeopleData.participants || [];
                return (
                  <div className="border-t pt-5">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      People ({1 + participants.length})
                    </h3>
                    <div className="space-y-2">
                      {/* Owner */}
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[13px] font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                          {ownerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-foreground truncate">{ownerName}</p>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-200 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 flex-shrink-0">Owner</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50">Task owner</p>
                        </div>
                      </div>
                      {/* All other participants */}
                      {participants.map(person => {
                        const isMe = person.name === visitorName;
                        const isBrowser = person.source === 'link';
                        return (
                          <div key={person.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${isMe ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200/80 dark:border-teal-500/30' : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200/60 dark:border-white/[0.07]'}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black flex-shrink-0 ${isMe ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' : 'bg-slate-200 dark:bg-white/[0.1] text-slate-600 dark:text-slate-300'}`}>
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-bold text-foreground truncate">{person.name}</p>
                                {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-200 dark:bg-teal-500/30 text-teal-700 dark:text-teal-300 flex-shrink-0">You</span>}
                                {isBrowser && !isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-200 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 flex-shrink-0">Link</span>}
                                {!isBrowser && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex-shrink-0">App</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground/50">
                                {person.lastActivity ? format(parseISO(person.lastActivity), 'MMM dd, HH:mm') : 'No activity yet'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Comments */}
              {visitorName && (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">
                      {t('comments', language)} ({responses.filter(r => r.response_type === 'comment').length})
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadResponses}
                      disabled={manualRefreshing}
                      className="h-7 px-2"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${manualRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
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
