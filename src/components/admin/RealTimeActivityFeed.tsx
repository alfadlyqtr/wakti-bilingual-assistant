
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: 'user_registration' | 'subscription_activation' | 'contact_submission' | 'task_creation';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
}

export const RealTimeActivityFeed = ({ activities, isLoading }: ActivityFeedProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-accent-green';
      case 'warning': return 'bg-accent-orange';
      case 'info': return 'bg-accent-blue';
      default: return 'bg-accent-purple';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user_registration': return '👤';
      case 'subscription_activation': return '💳';
      case 'contact_submission': return '📩';
      case 'task_creation': return '✅';
      default: return '📊';
    }
  };

  if (isLoading) {
    return (
      <Card className="enhanced-card">
        <CardHeader>
          <CardTitle className="text-enhanced-heading text-xl">Recent Activity</CardTitle>
          <CardDescription className="text-sm">Loading latest system events...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gradient-secondary/20 rounded-full"></div>
                  <div className="h-4 bg-gradient-secondary/20 rounded w-64"></div>
                </div>
                <div className="h-3 bg-gradient-secondary/20 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="text-enhanced-heading text-xl">Recent Activity</CardTitle>
        <CardDescription className="text-sm">Latest admin actions and system events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg hover:bg-gradient-secondary/20 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(activity.status)}`}></div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getTypeIcon(activity.type)}</span>
                    <span className="font-medium text-sm">{activity.message}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
