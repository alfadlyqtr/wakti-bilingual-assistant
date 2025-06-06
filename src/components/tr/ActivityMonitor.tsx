
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { Users, MessageCircle, CheckCircle, ExternalLink, Clock, RefreshCw, Pause } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Memoize shared tasks to prevent unnecessary re-calculations
  const sharedTasks = useMemo(() => {
    return tasks.filter(task => task.is_shared && task.share_link);
  }, [tasks]);

  // Load all responses for shared tasks
  const loadAllResponses = useCallback(async (isRefresh = false) => {
    if (!isRefresh && loading) return;
    if (sharedTasks.length === 0) {
      setLoading(false);
      setResponses({});
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allResponses: { [taskId: string]: TRSharedResponse[] } = {};
      
      for (const task of sharedTasks) {
        const taskResponses = await TRSharedService.getTaskResponses(task.id);
        // Sort by created_at descending to get newest first
        allResponses[task.id] = taskResponses.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      
      setResponses(allResponses);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading responses:', error);
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sharedTasks, loading]);

  // Set up real-time subscriptions for all shared tasks
  useEffect(() => {
    if (sharedTasks.length === 0) {
      setLoading(false);
      setResponses({});
      return;
    }

    // Initial load
    loadAllResponses();

    // Set up real-time subscriptions
    const channels: any[] = [];
    
    sharedTasks.forEach(task => {
      const channel = TRSharedService.subscribeToTaskUpdates(task.id, () => {
        console.log(`Real-time update for task ${task.id}`);
        loadAllResponses(true);
      });
      channels.push(channel);
    });

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(() => {
      loadAllResponses(true);
    }, 30000);

    return () => {
      channels.forEach(channel => channel.unsubscribe());
      clearInterval(interval);
    };
  }, [sharedTasks, loadAllResponses]);

  const getTaskStats = useCallback((taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const uniqueAssignees = [...new Set(taskResponses.map(r => r.visitor_name))];
    const completions = taskResponses.filter(r => r.response_type === 'completion' && r.is_completed);
    const comments = taskResponses.filter(r => r.response_type === 'comment');
    const snoozeRequests = taskResponses.filter(r => r.response_type === 'snooze_request');
    
    return {
      assignees: uniqueAssignees.length,
      completions: completions.length,
      comments: comments.length,
      snoozeRequests: snoozeRequests.length,
      recentActivity: taskResponses.slice(0, 3) // First 3 activities (newest)
    };
  }, [responses]);

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
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'comment':
        return <MessageCircle className="h-3 w-3 text-blue-600" />;
      case 'snooze_request':
        return <Pause className="h-3 w-3 text-orange-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-600" />;
    }
  }, []);

  const getActivityDescription = useCallback((activity: TRSharedResponse) => {
    switch (activity.response_type) {
      case 'completion':
        return activity.is_completed ? 'marked task as complete' : 'marked task as incomplete';
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

  const handleRefresh = () => {
    loadAllResponses(true);
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
        
        return (
          <Card key={task.id}>
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
                    {stats.recentActivity.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {stats.recentActivity.length} recent activities
                      </Badge>
                    )}
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
                  <div className="text-sm font-semibold">{stats.completions}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Completions
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.comments}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Comments
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.snoozeRequests}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Pause className="h-3 w-3" />
                    Requests
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    Recent Activity
                    <Badge variant="secondary" className="text-xs">Live</Badge>
                  </h4>
                  <div className="space-y-2">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={`${activity.id}-${index}`} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-2">
                        {getActivityIcon(activity.response_type)}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{activity.visitor_name}</span>
                          <span className="text-muted-foreground ml-1">
                            {getActivityDescription(activity)}
                          </span>
                          <div className="text-muted-foreground mt-1">
                            {formatRelativeTime(activity.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No recent activity yet
                </div>
              )}

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
