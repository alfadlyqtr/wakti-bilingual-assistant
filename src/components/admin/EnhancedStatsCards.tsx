
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, MessageSquare, TrendingUp, UserPlus, Clock, Gift, UserCheck, AlertTriangle, UserX, Mail } from "lucide-react";

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
        {[...Array(9)].map((_, i) => (
          <Card key={i} className="enhanced-card animate-pulse">
            <CardContent className="p-3 sm:p-4">
              <div className="h-20 bg-gradient-secondary/20 rounded"></div>
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
      description: "Registered accounts",
      trend: stats.newUsersThisMonth > 0 ? `+${stats.newUsersThisMonth} this month` : "No new users this month",
      bgGradient: "from-accent-blue/10 to-accent-blue/5"
    },
    {
      title: "Active Subscriptions", 
      value: stats.activeSubscriptions.toLocaleString(),
      icon: CreditCard,
      color: "text-accent-green",
      description: "Paying customers",
      badge: `${Math.round((stats.activeSubscriptions / Math.max(stats.totalUsers, 1)) * 100)}% conversion`,
      bgGradient: "from-accent-green/10 to-accent-green/5"
    },
    {
      title: "Gift Subscriptions",
      value: stats.giftSubscriptions.toLocaleString(),
      icon: Gift,
      color: "text-accent-purple",
      description: "Active gifts",
      badge: stats.giftSubscriptions > 0 ? "Active gifting" : "No gifts",
      bgGradient: "from-accent-purple/10 to-accent-purple/5"
    },
    {
      title: "Expiring Soon",
      value: stats.expiringSoon.toLocaleString(),
      icon: Clock,
      color: stats.expiringSoon > 0 ? "text-accent-orange" : "text-accent-green",
      description: "Within 7 days",
      badge: stats.expiringSoon > 0 ? `${stats.expiringSoon} need attention` : "All renewals on track",
      urgent: stats.expiringSoon > 0,
      bgGradient: stats.expiringSoon > 0 ? "from-accent-orange/10 to-accent-orange/5" : "from-accent-green/10 to-accent-green/5"
    },
    {
      title: "Unsubscribed Users",
      value: stats.unsubscribedUsers.toLocaleString(),
      icon: UserX,
      color: "text-accent-cyan",
      description: "Registered, not subscribed",
      badge: `${Math.round((stats.unsubscribedUsers / Math.max(stats.totalUsers, 1)) * 100)}% of total users`,
      bgGradient: "from-accent-cyan/10 to-accent-cyan/5"
    },
    {
      title: "Unconfirmed Emails",
      value: stats.unconfirmedAccounts.toLocaleString(),
      icon: Mail,
      color: stats.unconfirmedAccounts > 0 ? "text-accent-orange" : "text-accent-green",
      description: "Email not verified",
      badge: stats.unconfirmedAccounts > 0 ? "Need verification" : "All verified",
      bgGradient: stats.unconfirmedAccounts > 0 ? "from-accent-orange/10 to-accent-orange/5" : "from-accent-green/10 to-accent-green/5"
    },
    {
      title: "Monthly Revenue",
      value: `${stats.monthlyRevenue.toFixed(0)} QAR`,
      icon: TrendingUp,
      color: "text-accent-green",
      description: "Current active revenue",
      badge: stats.activeSubscriptions > 0 ? `Avg: ${Math.round(stats.monthlyRevenue / stats.activeSubscriptions)} QAR/user` : "No revenue",
      bgGradient: "from-accent-green/10 to-accent-green/5"
    },
    {
      title: "New This Month",
      value: stats.newUsersThisMonth.toLocaleString(),
      icon: UserCheck,
      color: "text-accent-blue",
      description: "New registrations",
      badge: stats.newUsersThisMonth > 0 ? "Growing" : "No growth",
      bgGradient: "from-accent-blue/10 to-accent-blue/5"
    },
    {
      title: "Pending Messages",
      value: stats.pendingMessages.toLocaleString(),
      icon: MessageSquare,
      color: stats.pendingMessages > 0 ? "text-accent-orange" : "text-accent-green",
      description: "Unread contacts",
      badge: stats.pendingMessages > 0 ? "Needs attention" : "All caught up",
      urgent: stats.pendingMessages > 0,
      bgGradient: stats.pendingMessages > 0 ? "from-accent-orange/10 to-accent-orange/5" : "from-accent-green/10 to-accent-green/5"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-4">
      {statsData.map((stat, index) => (
        <Card 
          key={index} 
          className={`enhanced-card hover:shadow-vibrant transition-all duration-300 relative overflow-hidden ${
            stat.urgent ? 'ring-2 ring-accent-orange/50' : ''
          }`}
        >
          {/* Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-50`} />
          
          <CardHeader className="pb-2 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {stat.title}
                {stat.urgent && <AlertTriangle className="inline h-3 w-3 ml-1 text-accent-orange" />}
              </CardTitle>
              <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color} flex-shrink-0`} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3 relative z-10">
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-enhanced-heading mb-1">
              {stat.value}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{stat.description}</p>
              {stat.badge && (
                <Badge 
                  variant="outline" 
                  className={`text-xs w-fit ${
                    stat.badge.includes('need attention') || stat.badge.includes('Need') ? 'border-accent-orange text-accent-orange bg-accent-orange/10' : 
                    stat.badge.includes('All') || stat.badge.includes('Growing') || stat.badge.includes('Active') ? 'border-accent-green text-accent-green bg-accent-green/10' :
                    'border-accent-blue text-accent-blue bg-accent-blue/10'
                  }`}
                >
                  {stat.badge}
                </Badge>
              )}
              {stat.trend && (
                <p className="text-xs text-accent-blue font-medium">{stat.trend}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
