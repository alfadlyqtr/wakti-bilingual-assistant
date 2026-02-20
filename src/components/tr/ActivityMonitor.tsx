
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse, TRSharedAccess } from '@/services/trSharedService';
import { 
  Users, MessageCircle, CheckCircle, ExternalLink, Clock, 
  RefreshCw, Pause, AlertCircle, Mail, User, 
  Calendar, Check, X, EyeIcon, ChevronDown, ChevronRight
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InAppSharedTaskViewer } from './InAppSharedTaskViewer';
import { supabase } from '@/integrations/supabase/client';

interface ActivityMonitorProps {
  tasks: TRTask[];
  onTasksChanged: () => void;
  incomingShareLink?: string | null;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({
  tasks,
  onTasksChanged,
  incomingShareLink = null,
}) => {
  const { language } = useTheme();
  const [responses, setResponses] = useState<{ [taskId: string]: TRSharedResponse[] }>({});
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: TRSubtask[] }>({});
  const [visitors, setVisitors] = useState<{ [taskId: string]: TRSharedAccess[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  
  // Collapsible state for task cards
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  // Owner display name (fetched from profile)
  const [ownerName, setOwnerName] = useState<string>('You');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', user.id)
        .single();
      const fullName = [data?.first_name, data?.last_name].filter(Boolean).join(' ');
      const name = data?.display_name || fullName || user.email?.split('@')[0] || 'You';
      
      setOwnerName(name);
    });
  }, []);

  // In-app shared task viewer (for Wakti users opening a share link)
  const [activeShareLink, setActiveShareLink] = useState<string | null>(incomingShareLink);

  // Sync if incomingShareLink changes (e.g. URL param update)
  useEffect(() => {
    if (incomingShareLink) setActiveShareLink(incomingShareLink);
  }, [incomingShareLink]);
  
  const loadingRef = useRef(false);
  
  // Active view for each task
  const [activeViews, setActiveViews] = useState<{ [taskId: string]: string }>({});

  // Memoize shared tasks to prevent unnecessary re-calculations
  const sharedTasks = useMemo(() => {
    const shared = tasks.filter(task => task.is_shared && task.share_link);
    return shared;
  }, [tasks]);

  // Parse snooze request status from content
  const parseSnoozeStatus = useCallback((content: string | undefined) => {
    if (!content) return null;
    try {
      const parsed = JSON.parse(content);
      return parsed.status;
    } catch {
      return null;
    }
  }, []);

  // Load all responses and subtasks for shared tasks
  const loadAllData = useCallback(async (isRefresh = false) => {
    // Prevent concurrent loading
    if (loadingRef.current) {
      return;
    }

    if (sharedTasks.length === 0) {
      setLoading(false);
      setResponses({});
      setSubtasks({});
      setVisitors({});
      return;
    }

    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allResponses: { [taskId: string]: TRSharedResponse[] } = {};
      const allSubtasks: { [taskId: string]: TRSubtask[] } = {};
      const allVisitors: { [taskId: string]: TRSharedAccess[] } = {};
      
      for (const task of sharedTasks) {
        // Load all data in parallel for each task
        const [taskResponses, taskSubtasks, taskVisitors] = await Promise.all([
          TRSharedService.getTaskResponses(task.id),
          TRSharedService.getTaskSubtasks(task.id),
          TRSharedService.getTaskVisitors(task.id)
        ]);
        
        allResponses[task.id] = taskResponses;
        allSubtasks[task.id] = taskSubtasks;
        allVisitors[task.id] = taskVisitors;
      }
      
      setResponses(allResponses);
      setSubtasks(allSubtasks);
      setVisitors(allVisitors);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading activity data:', error);
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [sharedTasks]);

  // Initial load and real-time subscriptions
  useEffect(() => {
    loadAllData();
    
    // Set up real-time subscriptions if we have shared tasks
    if (sharedTasks.length === 0) {
      return;
    }

    const channels: any[] = [];
    
    sharedTasks.forEach(task => {
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, () => {
        // Add a small delay to ensure database changes are committed
        setTimeout(() => {
          loadAllData(true);
        }, 500);
      });
      channels.push(channel);
    });

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(() => {
      loadAllData(true);
    }, 30000);

    return () => {
      channels.forEach(channel => channel.unsubscribe());
      clearInterval(interval);
    };
  }, [sharedTasks.length, loadAllData]);

  // Set default active view for each task
  useEffect(() => {
    const initialViews: { [taskId: string]: string } = {};
    
    sharedTasks.forEach(task => {
      if (!activeViews[task.id]) {
        initialViews[task.id] = 'all';
      }
    });
    
    if (Object.keys(initialViews).length > 0) {
      setActiveViews(prev => ({...prev, ...initialViews}));
    }
  }, [sharedTasks, activeViews]);

  // Uncheck requests are informational only; owner manually unchecks from their task view.

  const getTaskStats = useCallback((taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const taskSubtaskList = subtasks[taskId] || [];
    const taskVisitors = visitors[taskId] || [];
    
    // Get unique assignees
    const uniqueAssignees = [...new Set(taskResponses.map(r => r.visitor_name))];
    
    // Count completed subtasks based on owner truth from tr_subtasks
    const completedSubtasksCount = taskSubtaskList.filter(s => s.completed).length;
    
    // Count task completions (main task, not subtasks)
    const taskCompletions = taskResponses.filter(
      r => r.response_type === 'completion' && r.is_completed && !r.subtask_id
    );
    
    // Count comments and requests
    const comments = taskResponses.filter(r => r.response_type === 'comment');
    const snoozeRequests = taskResponses.filter(r => r.response_type === 'snooze_request');
    const uncheckRequests = taskResponses.filter(r => r.response_type === 'uncheck_request');
    const completionRequests = taskResponses.filter(r => r.response_type === 'completion_request');
    
    return {
      assignees: uniqueAssignees,
      completedSubtasksCount,
      taskCompletionsCount: taskCompletions.length,
      totalSubtasksCount: taskSubtaskList.length,
      comments: comments,
      snoozeRequests: snoozeRequests,
      uncheckRequests: uncheckRequests,
      completionRequests: completionRequests,
      allResponses: taskResponses,
      subtasks: taskSubtaskList,
      visitors: taskVisitors
    };
  }, [responses, subtasks, visitors]);

  const formatRelativeTime = useCallback((dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  }, []);

  const getActivityIcon = useCallback((responseType: string) => {
    switch (responseType) {
      case 'completion':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-600" />;
      case 'snooze_request':
        return <Pause className="h-4 w-4 text-orange-600" />;
      case 'completion_request':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  }, []);

  const getActivityDescription = useCallback((activity: TRSharedResponse, taskSubtasks: TRSubtask[]) => {
    // Find subtask title if this is a subtask completion
    let subtaskTitle = '';
    if (activity.subtask_id) {
      const subtask = taskSubtasks.find(s => s.id === activity.subtask_id);
      subtaskTitle = subtask ? subtask.title : 'a subtask';
    }
    
    switch (activity.response_type) {
      case 'completion':
        if (activity.subtask_id) {
          return activity.is_completed 
            ? `completed subtask: "${subtaskTitle}"` 
            : `marked subtask as incomplete: "${subtaskTitle}"`;
        }
        return activity.is_completed ? 'marked main task as complete' : 'marked main task as incomplete';
      case 'comment':
        return `commented: "${activity.content?.substring(0, 50)}${activity.content && activity.content.length > 50 ? '...' : ''}"`;
      case 'snooze_request':
        return `requested snooze${activity.content ? `: "${activity.content.substring(0, 30)}..."` : ''}`;
      case 'completion_request':
        return 'requested to mark task as complete';
      default:
        return 'performed an action';
    }
  }, []);

  const openSharedTask = useCallback((shareLink: string) => {
    window.open(`/shared-task/${shareLink}`, '_blank');
  }, []);

  const copyShareLink = useCallback((shareLink: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared-task/${shareLink}`);
    toast.success(t('linkCopied', language));
  }, [language]);

  const handleReply = async (taskId: string) => {
    if (!replyContent.trim() || !replyingTo) {
      return;
    }

    try {
      await TRSharedService.addComment(taskId, ownerName, replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
      toast.success(t('reply', language) + ' sent');
      loadAllData(true);
    } catch (error) {
      console.error('Error replying to comment:', error);
      toast.error('Failed to send reply');
    }
  };

  const handleRefresh = () => {
    loadAllData(true);
  };

  const handleViewChange = (taskId: string, view: string) => {
    setActiveViews(prev => ({...prev, [taskId]: view}));
  };

  const handleSnoozeRequest = async (
    taskId: string, 
    requestId: string, 
    action: 'approved' | 'denied'
  ) => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(requestId));
    
    try {
      if (action === 'approved') {
        await TRSharedService.approveSnoozeRequest(requestId, taskId);
        toast.success('Snooze request approved - task has been snoozed until tomorrow', {
          duration: 4000,
          position: 'bottom-center'
        });
        onTasksChanged(); // Refresh task list to show snoozed status
      } else {
        await TRSharedService.denySnoozeRequest(requestId);
        toast.success('Snooze request denied', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
      
      // Force immediate refresh with a delay to ensure database changes are committed
      setTimeout(() => {
        loadAllData(true);
      }, 1000);
      
    } catch (error) {
      console.error(`Error ${action} snooze request:`, error);
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'deny'} snooze request`, {
        duration: 3000,
        position: 'bottom-center'
      });
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleCompletionRequest = async (
    taskId: string, 
    requestId: string, 
    visitorName: string,
    action: 'approved' | 'denied'
  ) => {
    // Add to processing set to show loading state
    setProcessingRequests(prev => new Set(prev).add(requestId));
    
    try {
      if (action === 'approved') {
        await TRSharedService.approveCompletionRequest(requestId, taskId, visitorName);
        toast.success(`Task marked as completed by ${visitorName}`, {
          duration: 4000,
          position: 'bottom-center'
        });
        onTasksChanged(); // Refresh task list to show completed status
      } else {
        await TRSharedService.denyCompletionRequest(requestId);
        toast.success('Completion request denied', {
          duration: 3000,
          position: 'bottom-center'
        });
      }
      
      // Force immediate refresh with a delay to ensure database changes are committed
      setTimeout(() => {
        loadAllData(true);
      }, 1000);
      
    } catch (error) {
      console.error(`Error ${action} completion request:`, error);
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'deny'} completion request`, {
        duration: 3000,
        position: 'bottom-center'
      });
    } finally {
      // Remove from processing set
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Render snooze request status badge
  const renderSnoozeRequestStatus = (request: TRSharedResponse) => {
    const status = parseSnoozeStatus(request.content);
    const isProcessing = processingRequests.has(request.id);
    
    if (isProcessing) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          {t('processing', language)}...
        </Badge>
      );
    }
    
    if (status === 'approved') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          {t('approved', language)}
        </Badge>
      );
    }
    
    if (status === 'denied') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
          {t('denied', language)}
        </Badge>
      );
    }
    
    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={() => handleSnoozeRequest(request.task_id, request.id, 'approved')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <Check className="h-3 w-3 mr-1" />
          {t('approve', language)}
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleSnoozeRequest(request.task_id, request.id, 'denied')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <X className="h-3 w-3 mr-1" />
          {t('deny', language)}
        </Button>
      </div>
    );
  };

  // Render completion request status badge
  const renderCompletionRequestStatus = (request: TRSharedResponse) => {
    const status = parseSnoozeStatus(request.content); // reuse same parser
    const isProcessing = processingRequests.has(request.id);
    
    if (isProcessing) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1 animate-spin" />
          {t('processing', language)}...
        </Badge>
      );
    }
    
    if (status === 'approved') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Check className="h-3 w-3 mr-1" />
          {t('approved', language)}
        </Badge>
      );
    }
    
    if (status === 'denied') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
          {t('denied', language)}
        </Badge>
      );
    }
    
    return (
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={() => handleCompletionRequest(request.task_id, request.id, request.visitor_name, 'approved')}
          className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
          disabled={isProcessing}
        >
          <Check className="h-3 w-3 mr-1" />
          Approve & Complete
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleCompletionRequest(request.task_id, request.id, request.visitor_name, 'denied')}
          className="h-7 px-2 text-xs"
          disabled={isProcessing}
        >
          <X className="h-3 w-3 mr-1" />
          {t('deny', language)}
        </Button>
      </div>
    );
  };

  const toggleCardCollapse = useCallback((taskId: string) => {
    setCollapsedCards(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(taskId)) {
        newCollapsed.delete(taskId);
      } else {
        newCollapsed.add(taskId);
      }
      return newCollapsed;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200/40 dark:border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/60">{t('loading', language)}</p>
      </div>
    );
  }

  if (sharedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10
          flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
          <Users className="h-9 w-9 text-indigo-400 dark:text-indigo-500" />
        </div>
        <p className="text-base font-bold text-foreground mb-2">{t('noSharedTasks', language)}</p>
        <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">{t('shareTaskToStartMonitoring', language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ── In-app shared task viewer (Wakti users opening a share link) ── */}
      {activeShareLink && (
        <InAppSharedTaskViewer
          shareLink={activeShareLink}
          onDismiss={() => setActiveShareLink(null)}
        />
      )}

      {/* Header with refresh */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] font-medium text-muted-foreground/60">
          {t('lastUpdated', language)}: {formatRelativeTime(lastUpdate.toISOString())}
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold
            bg-indigo-100 dark:bg-indigo-500/20
            text-indigo-600 dark:text-indigo-400
            hover:bg-indigo-200 dark:hover:bg-indigo-500/30
            disabled:opacity-50 transition-all touch-manipulation active:scale-95"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? `${t('refreshing', language)}...` : t('refresh', language)}
        </button>
      </div>

      {/* Dialog for assignee details */}
      <Dialog open={!!selectedVisitor} onOpenChange={() => setSelectedVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('assigneeDetails', language)}</DialogTitle>
            <DialogDescription>
              {t('activityInformation', language)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedVisitor && sharedTasks.map(task => {
              const stats = getTaskStats(task.id);
              // Find activities for this visitor
              const visitorActivities = stats.allResponses.filter(r => 
                r.visitor_name === selectedVisitor
              );
              // Find visitor access info
              const visitorInfo = stats.visitors.find(v => v.viewer_name === selectedVisitor);
              
              if (!visitorActivities.length && !visitorInfo) return null;
              
              return (
                <Card key={`visitor-${task.id}`} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2">
                      <Avatar>
                        <AvatarFallback>{getInitials(selectedVisitor)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{selectedVisitor}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {visitorInfo ? `${t('lastSeen', language)} ${formatRelativeTime(visitorInfo.last_accessed)}` : t('noAccessData', language)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'completion' && a.is_completed).length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('completions', language)}</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'comment').length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('comments', language)}</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'snooze_request').length}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('requests', language)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{t('recentActivity', language)}</h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {visitorActivities.slice(0, 10).map(activity => (
                            <div key={activity.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-2">
                              {getActivityIcon(activity.response_type)}
                              <div>
                                <div className="text-xs text-muted-foreground">
                                  {formatRelativeTime(activity.created_at)}
                                </div>
                                <p className="text-xs mt-1">
                                  {getActivityDescription(activity, stats.subtasks)}
                                </p>
                              </div>
                            </div>
                          ))}
                          
                          {visitorActivities.length === 0 && (
                            <div className="text-center py-2 text-muted-foreground text-xs">
                              {t('noActivityRecorded', language)}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {sharedTasks.map((task) => {
        const stats = getTaskStats(task.id);
        const activeView = activeViews[task.id] || 'assignees';
        const isCollapsed = collapsedCards.has(task.id);
        const pendingCount = stats.completionRequests.filter(r => !parseSnoozeStatus(r.content)).length
          + stats.snoozeRequests.filter(r => !parseSnoozeStatus(r.content)).length
          + stats.uncheckRequests.length;

        return (
          <Collapsible key={task.id} open={!isCollapsed} onOpenChange={() => toggleCardCollapse(task.id)}>
            <div className={`rounded-2xl overflow-hidden
              bg-white dark:bg-white/[0.04]
              border border-slate-200/80 dark:border-white/[0.07]
              shadow-[0_2px_16px_hsla(0,0%,0%,0.07),0_1px_4px_hsla(0,0%,0%,0.05)]
              dark:shadow-[0_2px_16px_hsla(0,0%,0%,0.4),0_1px_4px_hsla(0,0%,0%,0.3)]
              transition-all duration-200`}>

              {/* ── Premium card header (collapsible trigger) ── */}
              <CollapsibleTrigger asChild>
                <button className="w-full text-left px-4 py-4 flex items-center gap-3
                  hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors touch-manipulation">

                  {/* Status dot */}
                  <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full
                    ${task.completed
                      ? 'bg-emerald-400 shadow-[0_0_6px_hsla(142,76%,55%,0.5)]'
                      : 'bg-indigo-400 dark:bg-indigo-500 shadow-[0_0_6px_hsla(240,80%,60%,0.4)]'
                    }`} />

                  {/* Title + badges */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-foreground leading-tight truncate" dir="auto">
                      {task.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {/* Shared badge */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        <Users className="h-2.5 w-2.5" />
                        {t('sharedTask', language)}
                      </span>
                      {/* Completion stamp */}
                      {task.completed && (() => {
                        const latest = stats.allResponses
                          .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        const who = latest?.visitor_name || 'Someone';
                        const when = latest?.created_at ? format(parseISO(latest.created_at), 'MMM dd, HH:mm') : '';
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                            bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-2.5 w-2.5" />
                            {who}{when ? ` · ${when}` : ''}
                          </span>
                        );
                      })()}
                      {/* Subtask progress */}
                      {stats.totalSubtasksCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                          bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                          <CheckCircle className="h-2.5 w-2.5" />
                          {stats.completedSubtasksCount}/{stats.totalSubtasksCount}
                        </span>
                      )}
                      {/* Assignees */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                        <Users className="h-2.5 w-2.5" />
                        {stats.assignees.length}
                      </span>
                      {/* Comments */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                        bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {stats.comments.length}
                      </span>
                      {/* Pending requests badge */}
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg
                          bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400
                          shadow-[0_0_8px_hsla(25,95%,55%,0.2)]">
                          <AlertCircle className="h-2.5 w-2.5" />
                          {pendingCount} {t('pending', language)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                    bg-slate-100 dark:bg-white/[0.06] transition-transform duration-200
                    ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-0">

                  {/* ── Per-card mini tab bar ── */}
                  <div className="flex items-center gap-1 px-1 pt-3 pb-2 overflow-x-auto" style={{scrollbarWidth:'none'}}>
                    {pendingCount > 0 && (
                      <button onClick={() => handleViewChange(task.id, 'approvals')}
                        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all touch-manipulation
                          ${activeView === 'approvals' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300' : 'bg-slate-100 dark:bg-white/[0.05] text-muted-foreground'}`}>
                        <AlertCircle className="h-3 w-3" />
                        {language === 'ar' ? 'موافقات' : 'Approvals'}
                        <span className="min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black bg-orange-500 text-white flex items-center justify-center">{pendingCount}</span>
                      </button>
                    )}
                    <button onClick={() => handleViewChange(task.id, 'assignees')}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all touch-manipulation
                        ${activeView === 'assignees' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-white/[0.05] text-muted-foreground'}`}>
                      <Users className="h-3 w-3" />
                      {language === 'ar' ? 'المشاركون' : 'Assignees'}
                      {stats.assignees.length > 0 && <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${activeView === 'assignees' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-white/[0.1] text-muted-foreground'}`}>{stats.assignees.length}</span>}
                    </button>
                    {stats.totalSubtasksCount > 0 && (
                      <button onClick={() => handleViewChange(task.id, 'subtasks')}
                        className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all touch-manipulation
                          ${activeView === 'subtasks' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-white/[0.05] text-muted-foreground'}`}>
                        <CheckCircle className="h-3 w-3" />
                        {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}
                        <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${activeView === 'subtasks' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-white/[0.1] text-muted-foreground'}`}>{stats.completedSubtasksCount}/{stats.totalSubtasksCount}</span>
                      </button>
                    )}
                    <button onClick={() => handleViewChange(task.id, 'comments')}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all touch-manipulation
                        ${activeView === 'comments' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-white/[0.05] text-muted-foreground'}`}>
                      <MessageCircle className="h-3 w-3" />
                      {language === 'ar' ? 'تعليقات' : 'Comments'}
                      {stats.comments.length > 0 && <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${activeView === 'comments' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-white/[0.1] text-muted-foreground'}`}>{stats.comments.length}</span>}
                    </button>
                    <button onClick={() => handleViewChange(task.id, 'activity')}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all touch-manipulation
                        ${activeView === 'activity' ? 'bg-slate-200 dark:bg-white/[0.12] text-foreground' : 'bg-slate-100 dark:bg-white/[0.05] text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" />
                      {language === 'ar' ? 'النشاط' : 'Activity'}
                    </button>
                  </div>

                  <div className="space-y-3 pb-4 px-1">

                    {/* ── APPROVALS tab ── */}
                    {activeView === 'approvals' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1 h-4 rounded-full bg-orange-500" />
                          <p className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                            {language === 'ar' ? 'الموافقات المعلقة' : 'Pending Approvals'} · {pendingCount}
                          </p>
                        </div>
                        {stats.completionRequests.filter(r => !parseSnoozeStatus(r.content)).map(request => (
                          <div key={request.id} className="rounded-xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-500/30 flex items-center justify-center text-[10px] font-black text-amber-700 dark:text-amber-300 flex-shrink-0">
                                {request.visitor_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                              <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                            </div>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">{language === 'ar' ? 'طلب إكمال المهمة' : 'Requesting task completion'}</p>
                            {renderCompletionRequestStatus(request)}
                          </div>
                        ))}
                        {stats.snoozeRequests.filter(r => !parseSnoozeStatus(r.content)).map(request => (
                          <div key={request.id} className="rounded-xl p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-500/30 flex items-center justify-center text-[10px] font-black text-orange-700 dark:text-orange-300 flex-shrink-0">
                                {request.visitor_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                              <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                            </div>
                            {request.content && !parseSnoozeStatus(request.content) && (
                              <p className="text-[12px] text-muted-foreground mb-2" dir="auto">{t('reason', language)}: {request.content}</p>
                            )}
                            {renderSnoozeRequestStatus(request)}
                          </div>
                        ))}
                        {stats.uncheckRequests.map(request => {
                          const st = stats.subtasks.find(s => s.id === request.subtask_id);
                          return (
                            <div key={request.id} className="rounded-xl p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/30">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-700 dark:text-blue-300 flex-shrink-0">
                                  {request.visitor_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[13px] font-bold text-foreground flex-1" dir="auto">{request.visitor_name}</span>
                                <span className="text-[10px] text-muted-foreground/60">{format(parseISO(request.created_at), 'MMM dd, HH:mm')}</span>
                              </div>
                              <p className="text-[12px] text-blue-700 dark:text-blue-400">{language === 'ar' ? 'طلب إلغاء تحديد' : 'Requesting uncheck'}: "{st?.title || 'subtask'}"</p>
                              {request.content && <p className="text-[12px] text-muted-foreground mt-1">{t('reason', language)}: {request.content}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── ASSIGNEES tab ── */}
                    {activeView === 'assignees' && (
                      <div className="space-y-2 pt-1">
                        {stats.assignees.length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد مشاركون بعد' : 'No assignees yet'}</p>
                        ) : stats.assignees.map(assignee => {
                          const acts = stats.allResponses.filter(r => r.visitor_name === assignee);
                          const lastAct = acts.length > 0 ? [...acts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                          const doneCount = stats.subtasks.filter(s => s.completed && stats.allResponses.some(r => r.subtask_id === s.id && r.visitor_name === assignee && r.is_completed)).length;
                          return (
                            <div key={assignee} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[13px] font-black text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                {assignee.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-foreground truncate" dir="auto">{assignee}</p>
                                <p className="text-[10px] text-muted-foreground/50">
                                  {lastAct ? formatRelativeTime(lastAct.created_at) : '—'}
                                  {stats.totalSubtasksCount > 0 && ` · ${doneCount}/${stats.totalSubtasksCount} subtasks`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── SUBTASKS tab ── */}
                    {activeView === 'subtasks' && (
                      <div className="space-y-1.5 pt-1">
                        {stats.subtasks.map(subtask => {
                          const completions = stats.allResponses.filter(r => r.response_type === 'completion' && r.subtask_id === subtask.id && r.is_completed);
                          const allWho = [...new Set(completions.map(c => c.visitor_name))];
                          const latest = completions.length > 0 ? [...completions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
                          const isCompleted = !!subtask.completed;
                          return (
                            <div key={subtask.id} className={`rounded-xl px-3 py-2.5 flex items-start gap-3 ${isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.05]'}`}>
                              <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${isCompleted ? 'bg-emerald-500' : 'border-2 border-slate-300 dark:border-white/20'}`}>
                                {isCompleted && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-semibold ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`} dir="auto">{subtask.title}</p>
                                {isCompleted && latest && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1" dir="auto">
                                    <Users className="h-2.5 w-2.5 flex-shrink-0" />
                                    {allWho.join(', ')} · {format(parseISO(latest.created_at), 'MMM dd, HH:mm')}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── COMMENTS tab ── */}
                    {activeView === 'comments' && (
                      <div className="space-y-2 pt-1">
                        {stats.comments.length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {stats.comments.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(comment => (
                              <div key={comment.id} className="rounded-xl p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-400 flex-shrink-0">
                                    {comment.visitor_name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[12px] font-bold text-foreground" dir="auto">{comment.visitor_name}</span>
                                  <span className="text-[10px] text-muted-foreground/50 ml-auto">{formatRelativeTime(comment.created_at)}</span>
                                </div>
                                <div className="bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2 text-[13px] text-foreground border border-slate-200/50 dark:border-white/[0.06]" dir="auto">
                                  {comment.content}
                                </div>
                                {replyingTo === comment.id ? (
                                  <div className="mt-2 space-y-2">
                                    <Textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder={`${t('typeYourReply', language)}...`} rows={2} className="text-sm" />
                                    <div className="flex gap-2 justify-end">
                                      <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyContent(''); }}>{t('cancel', language)}</Button>
                                      <Button size="sm" onClick={() => handleReply(task.id)} disabled={!replyContent.trim()}>{t('reply', language)}</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setReplyingTo(comment.id)} className="mt-1.5 text-[11px] font-bold text-purple-500 hover:text-purple-600 flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{t('reply', language)}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── ACTIVITY tab ── */}
                    {activeView === 'activity' && (
                      <div className="space-y-1.5 pt-1">
                        {stats.allResponses.filter(r => r.response_type !== 'comment').length === 0 ? (
                          <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{t('noActivityYet', language)}</p>
                        ) : (
                          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                            {stats.allResponses.filter(r => r.response_type !== 'comment').sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30).map(activity => (
                              <div key={activity.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                                {getActivityIcon(activity.response_type)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-foreground" dir="auto">{activity.visitor_name}</span>
                                    <span className="text-[10px] text-muted-foreground/50 ml-auto">{format(parseISO(activity.created_at), 'MMM dd, HH:mm')}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground" dir="auto">{getActivityDescription(activity, stats.subtasks)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </CardContent>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
};
