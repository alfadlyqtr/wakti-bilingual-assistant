
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, User, CreditCard, Gift, Clock, AlertTriangle } from "lucide-react";

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'subscription_activation' | 'subscription_expiry' | 'payment_received' | 'gift_given';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info' | 'error';
}

interface ScrollableRecentActivityProps {
  activities: RecentActivity[];
  isLoading: boolean;
}

export const ScrollableRecentActivity = ({ activities, isLoading }: ScrollableRecentActivityProps) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registration':
        return <User className="h-4 w-4 text-accent-blue" />;
      case 'subscription_activation':
        return <CreditCard className="h-4 w-4 text-accent-green" />;
      case 'gift_given':
        return <Gift className="h-4 w-4 text-accent-purple" />;
      case 'subscription_expiry':
        return <Clock className="h-4 w-4 text-accent-orange" />;
      case 'payment_received':
        return <CreditCard className="h-4 w-4 text-accent-cyan" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-accent-green text-white';
      case 'warning':
        return 'bg-accent-orange text-white';
      case 'error':
        return 'bg-accent-red text-white';
      case 'info':
      default:
        return 'bg-accent-blue text-white';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className="enhanced-card">
        <CardHeader>
          <CardTitle className="text-enhanced-heading flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-blue" />
            Recent Activity
          </CardTitle>
          <CardDescription>Loading activity feed...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
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
      <CardHeader>
        <CardTitle className="text-enhanced-heading flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent-blue" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Live updates from your system ({activities.length} recent events)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80 w-full">
          <div className="p-4 space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No recent activity found</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-accent/5 transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-enhanced-heading mb-1">
                      {activity.message}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getStatusColor(activity.status)}`}
                      >
                        {activity.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
