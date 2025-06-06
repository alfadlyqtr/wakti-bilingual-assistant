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
import { TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse, TRSharedAccess } from '@/services/trSharedService';
import { 
  Users, MessageCircle, CheckCircle, ExternalLink, Clock, 
  RefreshCw, Pause, AlertCircle, Mail, User, 
  Calendar, Check, X, EyeIcon
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ActivityMonitorProps {
  tasks: TRTask[];
  onTasksChanged: () => void;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({
  tasks,
  onTasksChanged
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
  const [approvedRequests, setApprovedRequests] = useState<Set<string>>(new Set());
  const [deniedRequests, setDeniedRequests] = useState<Set<string>>(new Set());
  const loadingRef = useRef(false);
  
  // Active view for each task
  const [activeViews, setActiveViews] = useState<{ [taskId: string]: string }>({});

  // Memoize shared tasks to prevent unnecessary re-calculations
  const sharedTasks = useMemo(() => {
    const shared = tasks.filter(task => task.is_shared && task.share_link);
    return shared;
  }, [tasks]);

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
        loadAllData(true);
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

  const getTaskStats = useCallback((taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const taskSubtaskList = subtasks[taskId] || [];
    const taskVisitors = visitors[taskId] || [];
    
    // Get unique assignees
    const uniqueAssignees = [...new Set(taskResponses.map(r => r.visitor_name))];
    
    // Count unique subtask completions (not completion events)
    const completedSubtaskIds = new Set<string>();
    taskResponses.forEach(r => {
      if (r.response_type === 'completion' && r.is_completed && r.subtask_id) {
        completedSubtaskIds.add(r.subtask_id);
      }
    });
    
    // Count task completions (main task, not subtasks)
    const taskCompletions = taskResponses.filter(
      r => r.response_type === 'completion' && r.is_completed && !r.subtask_id
    );
    
    // Count comments and requests
    const comments = taskResponses.filter(r => r.response_type === 'comment');
    const snoozeRequests = taskResponses.filter(r => r.response_type === 'snooze_request');
    
    return {
      assignees: uniqueAssignees,
      completedSubtasksCount: completedSubtaskIds.size,
      taskCompletionsCount: taskCompletions.length,
      totalSubtasksCount: taskSubtaskList.length,
      comments: comments,
      snoozeRequests: snoozeRequests,
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
      default:
        return 'performed an action';
    }
  }, []);

  const openSharedTask = useCallback((shareLink: string) => {
    window.open(`/shared/${shareLink}`, '_blank');
  }, []);

  const copyShareLink = useCallback((shareLink: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${shareLink}`);
    toast.success(t('linkCopied', language));
  }, [language]);

  const handleReply = async (taskId: string) => {
    if (!replyContent.trim() || !replyingTo) {
      return;
    }

    try {
      await TRSharedService.addComment(taskId, 'Owner (You)', replyContent.trim());
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply sent');
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
    try {
      if (action === 'approved') {
        await TRSharedService.approveSnoozeRequest(requestId, taskId);
        setApprovedRequests(prev => new Set(prev).add(requestId));
        toast.success('Snooze request approved');
        onTasksChanged(); // Refresh task list to show snoozed status
      } else {
        await TRSharedService.denySnoozeRequest(requestId);
        setDeniedRequests(prev => new Set(prev).add(requestId));
        toast.success('Snooze request denied');
      }
      
      loadAllData(true); // Refresh data
    } catch (error) {
      console.error(`Error ${action} snooze request:`, error);
      toast.error(`Failed to ${action === 'approved' ? 'approve' : 'deny'} snooze request`);
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">{t('loading', language)}</p>
      </div>
    );
  }

  if (sharedTasks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Shared Tasks</h3>
            <p className="text-muted-foreground">Share a task to start monitoring assignee activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Last updated: {formatRelativeTime(lastUpdate.toISOString())}
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Dialog for assignee details */}
      <Dialog open={!!selectedVisitor} onOpenChange={() => setSelectedVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assignee Details</DialogTitle>
            <DialogDescription>
              Activity information for this assignee
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
                          {visitorInfo ? `Last seen ${formatRelativeTime(visitorInfo.last_accessed)}` : 'No access data'}
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
                        <div className="text-xs text-muted-foreground">Completions</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'comment').length}
                        </div>
                        <div className="text-xs text-muted-foreground">Comments</div>
                      </div>
                      <div className="bg-secondary/20 rounded p-2 text-center">
                        <div className="text-sm font-semibold">
                          {visitorActivities.filter(a => a.response_type === 'snooze_request').length}
                        </div>
                        <div className="text-xs text-muted-foreground">Requests</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Recent Activity</h4>
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
                              No activity recorded
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
        const activeView = activeViews[task.id] || 'all';
        
        return (
          <Card key={task.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight break-words">
                    {task.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      Shared Task
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {stats.totalSubtasksCount > 0 
                        ? `${stats.completedSubtasksCount} of ${stats.totalSubtasksCount} subtasks completed`
                        : stats.taskCompletionsCount > 0 ? 'Task completed' : 'Not completed'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
              {/* Activity Stats - Responsive grid that stacks on mobile */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button 
                  className={`${
                    activeView === 'assignees' ? 'bg-primary/20 border-primary/30' : 'bg-secondary/20 hover:bg-secondary/30'
                  } transition-colors rounded-lg p-3 text-center border-2 border-transparent`}
                  onClick={() => handleViewChange(task.id, 'assignees')}
                >
                  <div className="text-lg font-semibold">{stats.assignees.length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Assignees
                  </div>
                </button>
                
                <button 
                  className={`${
                    activeView === 'completions' ? 'bg-primary/20 border-primary/30' : 'bg-secondary/20 hover:bg-secondary/30'
                  } transition-colors rounded-lg p-3 text-center border-2 border-transparent`}
                  onClick={() => handleViewChange(task.id, 'completions')}
                >
                  <div className="text-lg font-semibold">{stats.completedSubtasksCount}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completions
                  </div>
                </button>
                
                <button 
                  className={`${
                    activeView === 'comments' ? 'bg-primary/20 border-primary/30' : 'bg-secondary/20 hover:bg-secondary/30'
                  } transition-colors rounded-lg p-3 text-center border-2 border-transparent`}
                  onClick={() => handleViewChange(task.id, 'comments')}
                >
                  <div className="text-lg font-semibold">{stats.comments.length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Comments
                  </div>
                </button>
                
                <button 
                  className={`${
                    activeView === 'requests' ? 'bg-primary/20 border-primary/30' : 'bg-secondary/20 hover:bg-secondary/30'
                  } ${
                    stats.snoozeRequests.length > 0 ? 'ring-2 ring-orange-400 ring-offset-2' : ''
                  } transition-colors rounded-lg p-3 text-center border-2 border-transparent relative`}
                  onClick={() => handleViewChange(task.id, 'requests')}
                >
                  {stats.snoozeRequests.length > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-orange-500 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {stats.snoozeRequests.length}
                    </Badge>
                  )}
                  <div className="text-lg font-semibold">{stats.snoozeRequests.length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Requests
                  </div>
                </button>
              </div>

              {/* Content based on active view */}
              <div className="border rounded-lg p-4 min-h-[300px]">
                {/* All Activities View */}
                {activeView === 'all' && (
                  <>
                    <button 
                      className="bg-secondary/20 hover:bg-secondary/30 transition-colors rounded-lg p-3 text-center border-2 border-transparent w-full mb-4"
                      onClick={() => handleViewChange(task.id, 'all')}
                    >
                      <div className="text-lg font-semibold">{stats.allResponses.length}</div>
                      <div className="text-xs text-muted-foreground">All Activities</div>
                    </button>
                    
                    {stats.allResponses.length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {stats.allResponses
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice(0, 10)
                          .map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 text-sm bg-muted/30 rounded-lg p-3">
                              {getActivityIcon(activity.response_type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{activity.visitor_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(parseISO(activity.created_at), 'MMM dd, HH:mm')}
                                  </span>
                                </div>
                                <p className="text-muted-foreground">
                                  {getActivityDescription(activity, stats.subtasks)}
                                </p>
                                
                                {activity.response_type === 'comment' && activity.content && (
                                  <div className="bg-background mt-2 p-2 rounded border text-sm">
                                    {activity.content}
                                  </div>
                                )}
                                
                                {activity.response_type === 'snooze_request' && (
                                  <div className="mt-2 flex gap-2">
                                    {approvedRequests.has(activity.id) ? (
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        <Check className="h-3 w-3 mr-1" />
                                        Approved
                                      </Badge>
                                    ) : deniedRequests.has(activity.id) ? (
                                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                        <X className="h-3 w-3 mr-1" />
                                        Denied
                                      </Badge>
                                    ) : (
                                      <>
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleSnoozeRequest(task.id, activity.id, 'approved')}
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          Approve
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => handleSnoozeRequest(task.id, activity.id, 'denied')}
                                          className="h-7 px-2 text-xs"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Deny
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No activity yet
                      </div>
                    )}
                  </>
                )}
                
                {/* Assignees View */}
                {activeView === 'assignees' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Assignees ({stats.assignees.length})</h3>
                    
                    {stats.assignees.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stats.assignees.map(assignee => {
                          const assigneeInfo = stats.visitors.find(v => v.viewer_name === assignee);
                          const assigneeActivities = stats.allResponses.filter(r => r.visitor_name === assignee);
                          
                          const completions = assigneeActivities.filter(a => 
                            a.response_type === 'completion' && a.is_completed
                          ).length;
                          
                          const comments = assigneeActivities.filter(a => 
                            a.response_type === 'comment'
                          ).length;
                          
                          let lastActivity = '';
                          if (assigneeActivities.length > 0) {
                            const mostRecent = assigneeActivities.sort((a, b) => 
                              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            )[0];
                            lastActivity = formatRelativeTime(mostRecent.created_at);
                          } else if (assigneeInfo) {
                            lastActivity = formatRelativeTime(assigneeInfo.last_accessed);
                          } else {
                            lastActivity = 'No activity recorded';
                          }
                          
                          return (
                            <div 
                              key={assignee} 
                              className="border rounded-lg p-4 flex items-center space-x-3 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedVisitor(assignee)}
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>{getInitials(assignee)}</AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{assignee}</p>
                                <div className="flex items-center text-xs text-muted-foreground space-x-3 mt-1">
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {lastActivity}
                                  </span>
                                  
                                  <span className="flex items-center">
                                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                                    {completions}
                                  </span>
                                  
                                  <span className="flex items-center">
                                    <MessageCircle className="h-3 w-3 mr-1 text-blue-600" />
                                    {comments}
                                  </span>
                                </div>
                              </div>
                              
                              <EyeIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No assignees yet
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      <p>Click on an assignee to view detailed activity</p>
                    </div>
                  </div>
                )}

                {/* Comments View */}
                {activeView === 'comments' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Comments ({stats.comments.length})</h3>
                    
                    {stats.comments.length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {stats.comments
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((comment) => (
                            <div key={comment.id} className="bg-muted/30 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageCircle className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">{comment.visitor_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(comment.created_at)}
                                </span>
                              </div>
                              
                              <div className="bg-background p-3 rounded border mb-2">
                                {comment.content}
                              </div>
                              
                              {replyingTo === comment.id ? (
                                <div className="mt-3 space-y-2">
                                  <Textarea
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Type your reply..."
                                    rows={2}
                                    className="text-sm"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyContent('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      size="sm"
                                      onClick={() => handleReply(task.id)}
                                      disabled={!replyContent.trim()}
                                    >
                                      Reply
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs"
                                  onClick={() => setReplyingTo(comment.id)}
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Reply
                                </Button>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No comments yet
                      </div>
                    )}
                  </div>
                )}

                {/* Completions View */}
                {activeView === 'completions' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Completions</h3>
                    
                    {stats.allResponses.filter(r => r.response_type === 'completion').length > 0 ? (
                      <div className="space-y-4">
                        {/* Subtask completion status */}
                        {stats.totalSubtasksCount > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-base font-medium">Subtask Status</h4>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {stats.subtasks.map(subtask => {
                                const completions = stats.allResponses.filter(r => 
                                  r.response_type === 'completion' && 
                                  r.subtask_id === subtask.id &&
                                  r.is_completed
                                );
                                
                                const completedBy = [...new Set(completions.map(c => c.visitor_name))];
                                const isCompleted = completedBy.length > 0;
                                
                                return (
                                  <div 
                                    key={subtask.id} 
                                    className={`p-3 rounded-lg flex items-center gap-3 ${
                                      isCompleted ? 'bg-green-50 border border-green-200' : 'bg-muted/30'
                                    }`}
                                  >
                                    <div>
                                      {isCompleted ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <div className="h-5 w-5 border-2 rounded-full" />
                                      )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                        {subtask.title}
                                      </p>
                                      
                                      {isCompleted && (
                                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                          <User className="h-3 w-3" />
                                          {completedBy.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Completion activity history */}
                        <div className="space-y-3">
                          <h4 className="text-base font-medium">Completion History</h4>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {stats.allResponses
                              .filter(r => r.response_type === 'completion')
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .map((completion) => {
                                let subtaskInfo = null;
                                if (completion.subtask_id) {
                                  subtaskInfo = stats.subtasks.find(s => s.id === completion.subtask_id);
                                }
                                
                                return (
                                  <div key={completion.id} className="bg-muted/30 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CheckCircle className={`h-4 w-4 ${completion.is_completed ? 'text-green-600' : 'text-muted-foreground'}`} />
                                      <span className="font-medium text-sm">{completion.visitor_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(parseISO(completion.created_at), 'MMM dd, HH:mm')}
                                      </span>
                                    </div>
                                    
                                    <p className="text-sm text-muted-foreground ml-6">
                                      {completion.subtask_id 
                                        ? `${completion.is_completed ? 'Completed' : 'Marked incomplete'}: "${subtaskInfo?.title || 'subtask'}"` 
                                        : `${completion.is_completed ? 'Marked main task as complete' : 'Marked main task as incomplete'}`}
                                    </p>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No completions yet
                      </div>
                    )}
                  </div>
                )}

                {/* Requests View */}
                {activeView === 'requests' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-5 w-5" />
                      Snooze Requests ({stats.snoozeRequests.length})
                    </h3>
                    
                    {stats.snoozeRequests.length > 0 ? (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {stats.snoozeRequests
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((request) => (
                            <div key={request.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Pause className="h-4 w-4 text-orange-600" />
                                <span className="font-medium">{request.visitor_name}</span>
                                <Badge variant="secondary" className="text-xs">Snooze Request</Badge>
                              </div>
                              
                              <div className="text-xs text-muted-foreground mb-2">
                                {format(parseISO(request.created_at), 'MMM dd, HH:mm')}
                              </div>
                              
                              {request.content && (
                                <div className="bg-background/50 p-3 rounded border mb-3">
                                  <p className="text-sm">Reason: {request.content}</p>
                                </div>
                              )}
                              
                              <div className="flex gap-2">
                                {approvedRequests.has(request.id) ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex-1 justify-center py-2">
                                    <Check className="h-4 w-4 mr-1" />
                                    Approved
                                  </Badge>
                                ) : deniedRequests.has(request.id) ? (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex-1 justify-center py-2">
                                    <X className="h-4 w-4 mr-1" />
                                    Denied
                                  </Badge>
                                ) : (
                                  <>
                                    <Button 
                                      className="flex-1"
                                      size="sm" 
                                      onClick={() => handleSnoozeRequest(task.id, request.id, 'approved')}
                                    >
                                      <Check className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button 
                                      className="flex-1"
                                      variant="outline"
                                      size="sm" 
                                      onClick={() => handleSnoozeRequest(task.id, request.id, 'denied')}
                                    >
                                      <X className="h-4 w-4 mr-1" />
                                      Deny
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No snooze requests
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => openSharedTask(task.share_link!)}
                  size="sm"
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Shared View
                </Button>
                
                <Button
                  onClick={() => copyShareLink(task.share_link!)}
                  size="sm"
                  variant="outline"
                >
                  Copy Link
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
