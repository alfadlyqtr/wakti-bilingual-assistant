
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { Users, MessageCircle, CheckCircle, ExternalLink, Clock } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';

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

  const sharedTasks = tasks.filter(task => task.is_shared && task.share_link);

  useEffect(() => {
    loadAllResponses();
  }, [sharedTasks]);

  const loadAllResponses = async () => {
    setLoading(true);
    try {
      const allResponses: { [taskId: string]: TRSharedResponse[] } = {};
      
      for (const task of sharedTasks) {
        const taskResponses = await TRSharedService.getTaskResponses(task.id);
        allResponses[task.id] = taskResponses;
      }
      
      setResponses(allResponses);
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskStats = (taskId: string) => {
    const taskResponses = responses[taskId] || [];
    const uniqueVisitors = [...new Set(taskResponses.map(r => r.visitor_name))];
    const completions = taskResponses.filter(r => r.response_type === 'completion' && r.is_completed);
    const comments = taskResponses.filter(r => r.response_type === 'comment');
    const snoozeRequests = taskResponses.filter(r => r.response_type === 'snooze_request');
    
    return {
      visitors: uniqueVisitors.length,
      completions: completions.length,
      comments: comments.length,
      snoozeRequests: snoozeRequests.length,
      recentActivity: taskResponses.slice(-3) // Last 3 activities
    };
  };

  const openSharedTask = (shareLink: string) => {
    window.open(`/shared/${shareLink}`, '_blank');
  };

  const copyShareLink = (shareLink: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${shareLink}`);
    toast.success(t('linkCopied', language));
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
            <h3 className="text-lg font-semibold mb-2">{t('noSharedTasks', language)}</h3>
            <p className="text-muted-foreground">{t('shareTaskToStartMonitoring', language)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
                      {t('shared', language)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
              {/* Activity Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.visitors}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    {t('visitors', language)}
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.completions}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {t('completions', language)}
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.comments}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {t('comments', language)}
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold">{stats.snoozeRequests}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Requests
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {stats.recentActivity.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('recentActivity', language)}</h4>
                  <div className="space-y-1">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={`${activity.id}-${index}`} className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        <span className="font-medium">{activity.visitor_name}</span>
                        {activity.response_type === 'completion' && (
                          <span> marked task as {activity.is_completed ? 'complete' : 'incomplete'}</span>
                        )}
                        {activity.response_type === 'comment' && (
                          <span> added a comment</span>
                        )}
                        {activity.response_type === 'snooze_request' && (
                          <span> requested a snooze</span>
                        )}
                      </div>
                    ))}
                  </div>
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
                  {t('openSharedView', language)}
                </Button>
                
                <Button
                  onClick={() => copyShareLink(task.share_link!)}
                  size="sm"
                  variant="outline"
                >
                  {t('copyLink', language)}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
