
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRVisitorCompletion, TRSharedAccessExtended } from '@/services/trSharedService';
import { Activity, CheckCircle, Eye, Clock, User } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface ActivityFeedWidgetProps {
  sharedTasks: TRTask[];
}

interface ActivityItem {
  id: string;
  type: 'completion' | 'visitor_join' | 'visitor_leave';
  taskTitle: string;
  visitorName: string;
  timestamp: string;
  details?: string;
}

export const ActivityFeedWidget: React.FC<ActivityFeedWidgetProps> = ({
  sharedTasks
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sharedTasks.length > 0) {
      loadActivityFeed();
      setupRealtimeUpdates();
    } else {
      setLoading(false);
    }
  }, [sharedTasks.length]);

  const loadActivityFeed = async () => {
    try {
      setLoading(true);
      const allActivities: ActivityItem[] = [];

      // Load completions for all shared tasks
      for (const task of sharedTasks) {
        const [completions, visitors] = await Promise.all([
          TRSharedService.getVisitorCompletions(task.id),
          TRSharedService.getActiveVisitors(task.id)
        ]);

        // Add completion activities
        completions.forEach(completion => {
          allActivities.push({
            id: completion.id,
            type: 'completion',
            taskTitle: task.title,
            visitorName: completion.visitor_name,
            timestamp: completion.created_at,
            details: completion.completion_type === 'task' ? 'task' : 'subtask'
          });
        });

        // Add recent visitor activities
        visitors.forEach(visitor => {
          allActivities.push({
            id: `visitor-${visitor.id}`,
            type: 'visitor_join',
            taskTitle: task.title,
            visitorName: visitor.viewer_name || 'Anonymous',
            timestamp: visitor.last_accessed
          });
        });
      }

      // Sort by timestamp (most recent first)
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Take only the most recent 20 activities
      setActivities(allActivities.slice(0, 20));
    } catch (error) {
      console.error('Error loading activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeUpdates = () => {
    const channels = sharedTasks.map(task =>
      TRSharedService.subscribeToTaskUpdates(task.id, () => {
        loadActivityFeed();
      })
    );

    return () => {
      channels.forEach(channel => channel.unsubscribe());
    };
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return `Today at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd at HH:mm');
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completion':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'visitor_join':
        return <Eye className="h-4 w-4 text-blue-600" />;
      case 'visitor_leave':
        return <User className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityDescription = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'completion':
        return `marked ${activity.details} as complete`;
      case 'visitor_join':
        return 'started viewing task';
      case 'visitor_leave':
        return 'stopped viewing task';
      default:
        return 'had activity';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                <div className="mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm">
                    <span className="font-medium">{activity.visitorName}</span>
                    <span className="text-muted-foreground"> {getActivityDescription(activity)} in </span>
                    <span className="font-medium">"{activity.taskTitle}"</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
