
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TRTask } from '@/services/trService';
import { TRSharedService, TRVisitorCompletion, TRSharedAccessExtended } from '@/services/trSharedService';
import { Activity, CheckCircle, UserCheck, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface ActivityFeedWidgetProps {
  sharedTasks: TRTask[];
}

interface ActivityItem {
  id: string;
  type: 'completion' | 'assignee_join' | 'assignee_leave';
  taskTitle: string;
  assigneeName: string;
  timestamp: string;
  details?: string;
}

export const ActivityFeedWidget: React.FC<ActivityFeedWidgetProps> = ({
  sharedTasks
}) => {
  const { language } = useTheme();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

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
        const [completions, assignees] = await Promise.all([
          TRSharedService.getVisitorCompletions(task.id),
          TRSharedService.getActiveVisitors(task.id)
        ]);

        // Add completion activities
        completions.forEach(completion => {
          allActivities.push({
            id: completion.id,
            type: 'completion',
            taskTitle: task.title,
            assigneeName: completion.visitor_name,
            timestamp: completion.created_at,
            details: completion.completion_type === 'task' ? 'task' : 'subtask'
          });
        });

        // Add recent assignee activities
        assignees.forEach(assignee => {
          allActivities.push({
            id: `assignee-${assignee.id}`,
            type: 'assignee_join',
            taskTitle: task.title,
            assigneeName: assignee.viewer_name || 'Anonymous',
            timestamp: assignee.last_accessed
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
      return `${t('today', language)} at ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `${language === 'ar' ? 'أمس' : 'Yesterday'} at ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM dd at HH:mm');
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completion':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'assignee_join':
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case 'assignee_leave':
        return <User className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityDescription = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'completion':
        return language === 'ar' ? `قام بتحديد ${activity.details === 'task' ? 'المهمة' : 'المهمة الفرعية'} كمكتملة` : `marked ${activity.details} as complete`;
      case 'assignee_join':
        return language === 'ar' ? 'تم تكليفه بالمهمة' : 'was assigned to task';
      case 'assignee_leave':
        return language === 'ar' ? 'تم إلغاء تكليفه من المهمة' : 'was unassigned from task';
      default:
        return language === 'ar' ? 'كان له نشاط' : 'had activity';
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('recentActivity', language)}
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
      <CardHeader className="pb-2">
        <CardTitle 
          className="flex items-center justify-between cursor-pointer"
          onClick={toggleExpanded}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('recentActivity', language)}
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          {activities.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('noRecentActivity', language)}</p>
            </div>
          ) : (
            <ScrollArea className="h-64 w-full">
              <div className="space-y-3 pr-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                    <div className="mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{activity.assigneeName}</span>
                        <span className="text-muted-foreground"> {getActivityDescription(activity)} </span>
                        <span className="font-medium">"{activity.taskTitle}"</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
};
