
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, CheckCircle, AlertTriangle, Zap, TrendingUp } from "lucide-react";

interface FawranStatsCardsProps {
  stats: {
    totalPayments: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    autoApprovedPayments: number;
    manualReviewedPayments: number;
    tamperingDetected: number;
    duplicateDetected: number;
    timeValidationFailed: number;
  };
  autoApprovalRate: number;
  avgProcessingTime: number;
  isLoading: boolean;
}

export function FawranStatsCards({ stats, autoApprovalRate, avgProcessingTime, isLoading }: FawranStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-20"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-12 mb-2"></div>
              <div className="h-3 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const securityScore = stats.totalPayments > 0 
    ? Math.round(((stats.totalPayments - stats.tamperingDetected - stats.duplicateDetected) / stats.totalPayments) * 100)
    : 100;

  const statsItems = [
    {
      title: "Total Payments",
      value: stats.totalPayments,
      icon: TrendingUp,
      color: "text-accent-blue",
      bgColor: "bg-accent-blue/10"
    },
    {
      title: "Auto-Approval Rate",
      value: `${autoApprovalRate}%`,
      icon: Zap,
      color: "text-accent-green",
      bgColor: "bg-accent-green/10",
      description: `${stats.autoApprovedPayments}/${stats.totalPayments} approved`
    },
    {
      title: "Avg Processing Time",
      value: `${avgProcessingTime}s`,
      icon: Clock,
      color: "text-accent-orange",
      bgColor: "bg-accent-orange/10",
      description: avgProcessingTime < 90 ? '✅ Under 90s guarantee' : '⚠️ Above 90s target'
    },
    {
      title: "Pending Review",
      value: stats.pendingPayments,
      icon: Clock,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple/10",
      description: "Manual review needed"
    },
    {
      title: "Security Score",
      value: `${securityScore}%`,
      icon: Shield,
      color: "text-accent-cyan",
      bgColor: "bg-accent-cyan/10",
      description: `${stats.tamperingDetected + stats.duplicateDetected} threats blocked`
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-enhanced-heading">🔒 Fawran Security Dashboard</h3>
        <Badge variant="secondary" className="bg-accent-green/20 text-accent-green">
          <Shield className="h-3 w-3 mr-1" />
          GPT-4 Vision Active
        </Badge>
      </div>
      
      {/* Line Style Stats */}
      <div className="space-y-2">
        {statsItems.map((stat, index) => (
          <div key={index} className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <div className="font-medium text-sm">{stat.title}</div>
                {stat.description && (
                  <div className="text-xs text-muted-foreground">{stat.description}</div>
                )}
              </div>
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Security Alerts Row */}
      {(stats.tamperingDetected > 0 || stats.duplicateDetected > 0 || stats.timeValidationFailed > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="enhanced-card border-accent-red/20 bg-red-50 dark:bg-red-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-accent-red flex items-center text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Tampering Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-red">{stats.tamperingDetected}</div>
              <CardDescription className="text-xs">AI-detected image manipulation</CardDescription>
            </CardContent>
          </Card>

          <Card className="enhanced-card border-accent-orange/20 bg-orange-50 dark:bg-orange-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-accent-orange flex items-center text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Duplicates Blocked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-orange">{stats.duplicateDetected}</div>
              <CardDescription className="text-xs">Hash-based duplicate prevention</CardDescription>
            </CardContent>
          </Card>

          <Card className="enhanced-card border-accent-purple/20 bg-purple-50 dark:bg-purple-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-accent-purple flex items-center text-sm">
                <Clock className="h-4 w-4 mr-1" />
                Time Validation Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-purple">{stats.timeValidationFailed}</div>
              <CardDescription className="text-xs">Outside 90-minute window</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
