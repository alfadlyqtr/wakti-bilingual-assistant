
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { Users, MessageCircle, CheckCircle, ExternalLink, Clock, RefreshCw, Pause, AlertCircle, Mail } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const loadingRef = useRef(false);
  
  // Default active tab for all tasks
  const [activeTabsState, setActiveTabsState] = useState<{ [taskId: string]: string }>({});

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
      return;
    }

    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allResponses: { [taskId: string]: TRSharedResponse[] } = {};
      const allSubtasks: { [taskId: string]: TRSubtask[] } = {};
      
      for (const task of sharedTasks) {
        // Load both responses and subtasks in parallel for each task
        const [taskResponses, taskSubtasks] = await Promise.all([
          TRSharedService.getTaskResponses(task.id),
          TRSharedService.getTaskSubtasks(task.id)
        ]);
        
        allResponses[task.id] = taskResponses;
        allSubtasks[task.id] = taskSubtasks;
      }
      
      setResponses(allResponses);
      setSubtasks(allSubtasks);
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

  // Set active tab for a task if not already set
  useEffect(() => {
    const initialTabs: { [taskId: string]: string } = {};
    
    sharedTasks.forEach(task => {
      if (!activeTabsState[task.id]) {
        initialTabs[task.id] = 'all';
      }
    });
    
    if (Object.keys(initialTabs).length > 0) {
      setActiveTabsState(prev => ({...prev, ...initialTabs}));
    }
  }, [sharedTasks, activeTabsState]);

  const getTaskStats = useCallback((taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const taskSubtaskList = subtasks[taskId] || [];
    
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
      assignees: uniqueAssignees.length,
      completedSubtasksCount: completedSubtaskIds.size,
      taskCompletionsCount: taskCompletions.length,
      totalSubtasksCount: taskSubtaskList.length,
      comments: comments,
      snoozeRequests: snoozeRequests,
      allResponses: taskResponses,
      subtasks: taskSubtaskList
    };
  }, [responses, subtasks]);

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

  const handleTabChange = (taskId: string, value: string) => {
    setActiveTabsState(prev => ({...prev, [taskId]: value}));
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

      {sharedTasks.map((task) => {
        const stats = getTaskStats(task.id);
        const activeTab = activeTabsState[task.id] || 'all';
        
        return (
          <Card key={task.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight break-words">
                    {task.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
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
              {/* Activity Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.assignees}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Assignees
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.completedSubtasksCount}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completions
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.comments.length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Comments
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.snoozeRequests.length}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Requests
                  </div>
                </div>
              </div>

              {/* Activity Tabs */}
              <Tabs 
                value={activeTab} 
                onValueChange={(value) => handleTabChange(task.id, value)}
                className="w-full border rounded-md"
              >
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="comments">
                    Comments
                    {stats.comments.length > 0 && <Badge variant="secondary" className="ml-1">{stats.comments.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="completions">Completions</TabsTrigger>
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                </TabsList>

                {/* All Activities Tab */}
                <TabsContent value="all" className="p-3 space-y-3">
                  {stats.allResponses.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {stats.allResponses
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 10)
                        .map((activity) => (
                          <div key={activity.id} className="flex items-start gap-2 text-sm bg-muted/30 rounded p-3">
                            {getActivityIcon(activity.response_type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{activity.visitor_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(activity.created_at)}
                                </span>
                              </div>
                              <p className="text-muted-foreground mt-1">
                                {getActivityDescription(activity, stats.subtasks)}
                              </p>
                              
                              {/* Show full content for comments */}
                              {activity.response_type === 'comment' && activity.content && (
                                <div className="bg-background mt-2 p-2 rounded border text-sm">
                                  {activity.content}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No activity yet
                    </div>
                  )}
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="p-3 space-y-3">
                  {stats.comments.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {stats.comments
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((comment) => (
                          <div key={comment.id} className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageCircle className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{comment.visitor_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            
                            <div className="bg-background p-2 rounded border my-2">
                              {comment.content}
                            </div>
                            
                            {replyingTo === comment.id ? (
                              <div className="mt-2 space-y-2">
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
                                className="text-xs mt-1"
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
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No comments yet
                    </div>
                  )}
                </TabsContent>

                {/* Completions Tab */}
                <TabsContent value="completions" className="p-3 space-y-3">
                  {stats.allResponses.filter(r => r.response_type === 'completion').length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {stats.allResponses
                        .filter(r => r.response_type === 'completion')
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((completion) => {
                          // Find subtask info
                          let subtaskInfo = null;
                          if (completion.subtask_id) {
                            subtaskInfo = stats.subtasks.find(s => s.id === completion.subtask_id);
                          }
                          
                          return (
                            <div key={completion.id} className="bg-muted/30 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className={`h-4 w-4 ${completion.is_completed ? 'text-green-600' : 'text-muted-foreground'}`} />
                                <span className="font-medium">{completion.visitor_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(completion.created_at)}
                                </span>
                              </div>
                              
                              <p className="text-sm mt-1 ml-6">
                                {completion.subtask_id 
                                  ? `${completion.is_completed ? 'Completed' : 'Marked incomplete'}: "${subtaskInfo?.title || 'subtask'}"` 
                                  : `${completion.is_completed ? 'Marked main task as complete' : 'Marked main task as incomplete'}`}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No completions yet
                    </div>
                  )}
                </TabsContent>

                {/* Requests Tab */}
                <TabsContent value="requests" className="p-3 space-y-3">
                  {stats.snoozeRequests.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {stats.snoozeRequests
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((request) => (
                          <div key={request.id} className="bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Pause className="h-4 w-4 text-orange-600" />
                              <span className="font-medium">{request.visitor_name}</span>
                              <Badge variant="secondary" className="text-xs">Snooze Request</Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(request.created_at)}
                              </span>
                            </div>
                            
                            {request.content && (
                              <div className="bg-background/50 p-2 rounded border mt-2">
                                <p className="text-sm">Reason: {request.content}</p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No requests yet
                    </div>
                  )}
                </TabsContent>
              </Tabs>

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
