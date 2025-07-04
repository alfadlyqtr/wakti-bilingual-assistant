
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, MessageSquare, TrendingUp, UserPlus, Clock, Gift, UserCheck, AlertTriangle } from "lucide-react";

interface EnhancedStatsCardsProps {
  stats: {
    totalUsers: number;
    activeSubscriptions: number;
    giftSubscriptions: number;
    expiringSoon: number;
    unsubscribedUsers: number;
    unconfirmedAccounts: number;
    monthlyRevenue: number;
    newUsersThisMonth: number;
    pendingMessages: number;
  };
  isLoading: boolean;
}

export const EnhancedStatsCards = ({ stats, isLoading }: EnhancedStatsCardsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="enhanced-card animate-pulse">
            <CardContent className="p-3 sm:p-4">
              <div className="h-16 bg-gradient-secondary/20 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: "text-accent-blue",
      description: "Registered accounts"
    },
    {
      title: "Active Subscriptions", 
      value: stats.activeSubscriptions.toLocaleString(),
      icon: CreditCard,
      color: "text-accent-green",
      description: "Paying customers"
    },
    {
      title: "Gift Subscriptions",
      value: stats.giftSubscriptions.toLocaleString(),
      icon: Gift,
      color: "text-accent-purple",
      description: "Active gifts"
    },
    {
      title: "Expiring Soon",
      value: stats.expiringSoon.toLocaleString(),
      icon: Clock,
      color: stats.expiringSoon > 0 ? "text-accent-orange" : "text-accent-green",
      description: "Within 7 days",
      badge: stats.expiringSoon > 0 ? `${stats.expiringSoon} need attention` : "All good"
    },
    {
      title: "Unsubscribed Users",
      value: stats.unsubscribedUsers.toLocaleString(),
      icon: UserPlus,
      color: "text-accent-cyan",
      description: "Registered, not subscribed"
    },
    {
      title: "Unconfirmed Emails",
      value: stats.unconfirmedAccounts.toLocaleString(),
      icon: AlertTriangle,
      color: stats.unconfirmedAccounts > 0 ? "text-accent-orange" : "text-accent-green",
      description: "Email not verified"
    },
    {
      title: "Monthly Revenue",
      value: `${stats.monthlyRevenue.toFixed(0)} QAR`,
      icon: TrendingUp,
      color: "text-accent-green",
      description: "Current active revenue"
    },
    {
      title: "New This Month",
      value: stats.newUsersThisMonth.toLocaleString(),
      icon: UserCheck,
      color: "text-accent-blue",
      description: "New registrations"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.badge && (
                <Badge 
                  variant="outline" 
                  className={`text-xs w-fit ${
                    stat.badge.includes('need attention') ? 'border-accent-orange text-accent-orange' : 
                    'border-accent-green text-accent-green'
                  }`}
                >
                  {stat.badge}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
