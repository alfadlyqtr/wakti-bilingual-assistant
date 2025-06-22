
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, MessageSquare, BarChart3, TrendingUp, UserPlus, Clock } from "lucide-react";

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="enhanced-card animate-pulse">
            <CardContent className="p-3 sm:p-4">
              <div className="h-16 bg-gradient-secondary/20 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate derived stats
  const freeUsers = stats.totalUsers - stats.activeSubscriptions;
  const expiringSoon = 0; // This would come from subscription expiry logic

  const statsData = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: "text-accent-blue",
      description: "Registered users"
    },
    {
      title: "Active Subscriptions", 
      value: stats.activeSubscriptions.toLocaleString(),
      icon: CreditCard,
      color: "text-accent-green",
      description: "Paying customers"
    },
    {
      title: "Expiring Soon (7 days)",
      value: expiringSoon.toLocaleString(),
      icon: Clock,
      color: "text-accent-orange", 
      description: "Need attention"
    },
    {
      title: "Free Users",
      value: freeUsers.toLocaleString(),
      icon: UserPlus,
      color: "text-accent-purple",
      description: "Non-subscribers"
    },
    {
      title: "Pending Messages",
      value: stats.pendingMessages.toLocaleString(),
      icon: MessageSquare,
      color: "text-accent-orange",
      description: "Unread contacts"
    },
    {
      title: "Monthly Revenue",
      value: `${stats.monthlyRevenue.toFixed(0)} QAR`,
      icon: TrendingUp,
      color: "text-accent-cyan",
      description: "This month"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {statsData.map((stat, index) => (
        <Card key={index} className="enhanced-card hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color} flex-shrink-0`} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-enhanced-heading mb-1">
              {stat.value}
            </div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
