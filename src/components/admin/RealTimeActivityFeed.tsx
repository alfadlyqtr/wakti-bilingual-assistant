import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, MessageSquare, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'subscription_activation' | 'contact_submission' | 'task_creation';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

interface ActivityFeedProps {
  activities: RecentActivity[];
  isLoading: boolean;
}

export const RealTimeActivityFeed = ({ activities, isLoading }: ActivityFeedProps) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registration':
        return <Users className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'subscription_activation':
        return <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'contact_submission':
        return <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />;
      default:
        return <Activity className="h-3 w-3 sm:h-4 sm:w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-accent-green';
      case 'warning': return 'bg-accent-orange';
      case 'info': return 'bg-accent-blue';
      default: return 'bg-accent-gray';
    }
  };

  if (isLoading) {
    return (
      <Card className="enhanced-card">
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="text-sm sm:text-base lg:text-lg flex items-center">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-blue" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-secondary/20 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-3 sm:h-4 bg-gradient-secondary/20 rounded mb-1"></div>
                  <div className="h-2 sm:h-3 bg-gradient-secondary/20 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="enhanced-card">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base lg:text-lg flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-blue" />
            Recent Activity
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="w-full">
          {activities.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-2 sm:space-x-3 p-2 rounded-lg hover:bg-accent/5 transition-colors">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 ${getStatusColor(activity.status)} rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-enhanced-heading font-medium leading-tight">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-6">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs sm:text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
