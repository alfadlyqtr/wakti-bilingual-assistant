
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, MessageSquare, BarChart3, TrendingUp, UserPlus } from "lucide-react";

interface StatsCardsProps {
  stats: {
    totalUsers: number;
    activeSubscriptions: number;
    pendingMessages: number;
    onlineUsers: number;
    monthlyRevenue: number;
    newUsersToday: number;
  };
  isLoading: boolean;
}

export const RealTimeStatsCards = ({ stats, isLoading }: StatsCardsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="enhanced-card animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gradient-secondary/20 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Total Users</CardTitle>
            <Users className="h-6 w-6 text-accent-blue" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.totalUsers.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Registered users</p>
        </CardContent>
      </Card>

      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-6 w-6 text-accent-green" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.activeSubscriptions.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Paying customers</p>
        </CardContent>
      </Card>

      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Pending Messages</CardTitle>
            <MessageSquare className="h-6 w-6 text-accent-orange" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.pendingMessages.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Unread contacts</p>
        </CardContent>
      </Card>

      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Online Users</CardTitle>
            <BarChart3 className="h-6 w-6 text-accent-purple" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.onlineUsers.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Currently active</p>
        </CardContent>
      </Card>

      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-6 w-6 text-accent-cyan" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.monthlyRevenue.toFixed(0)} QAR
          </div>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>

      <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">New Users Today</CardTitle>
            <UserPlus className="h-6 w-6 text-accent-green" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-enhanced-heading mb-1">
            {stats.newUsersToday.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Signups today</p>
        </CardContent>
      </Card>
    </div>
  );
};
