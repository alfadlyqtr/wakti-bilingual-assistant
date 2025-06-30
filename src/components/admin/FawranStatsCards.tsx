
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-enhanced-heading">🔒 Fawran Security Dashboard</h3>
        <Badge variant="secondary" className="bg-accent-green/20 text-accent-green">
          <Shield className="h-3 w-3 mr-1" />
          GPT-4 Vision Active
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Payments */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <TrendingUp className="h-4 w-4 mr-1 text-accent-blue group-hover:scale-110 transition-transform" />
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-enhanced-heading">{stats.totalPayments}</div>
            <CardDescription className="text-xs">All time submissions</CardDescription>
          </CardContent>
        </Card>

        {/* Auto-Approval Rate */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Zap className="h-4 w-4 mr-1 text-accent-green group-hover:scale-110 transition-transform" />
              Auto-Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-green">{autoApprovalRate}%</div>
            <CardDescription className="text-xs">
              {stats.autoApprovedPayments}/{stats.totalPayments} approved
            </CardDescription>
          </CardContent>
        </Card>

        {/* Processing Time */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Clock className="h-4 w-4 mr-1 text-accent-orange group-hover:scale-110 transition-transform" />
              Avg Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-orange">{avgProcessingTime}s</div>
            <CardDescription className="text-xs">
              {avgProcessingTime < 90 ? '✅ Under 90s guarantee' : '⚠️ Above 90s target'}
            </CardDescription>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Clock className="h-4 w-4 mr-1 text-accent-purple group-hover:scale-110 transition-transform" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-purple">{stats.pendingPayments}</div>
            <CardDescription className="text-xs">Manual review needed</CardDescription>
          </CardContent>
        </Card>

        {/* Security Score */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <Shield className="h-4 w-4 mr-1 text-accent-cyan group-hover:scale-110 transition-transform" />
              Security Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-cyan">{securityScore}%</div>
            <CardDescription className="text-xs">
              {stats.tamperingDetected + stats.duplicateDetected} threats blocked
            </CardDescription>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="enhanced-card group hover:shadow-vibrant transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-enhanced-heading flex items-center text-sm">
              <CheckCircle className="h-4 w-4 mr-1 text-accent-green group-hover:scale-110 transition-transform" />
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-accent-green">Approved</span>
                <span className="font-medium">{stats.approvedPayments}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-accent-red">Rejected</span>
                <span className="font-medium">{stats.rejectedPayments}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-accent-purple">Pending</span>
                <span className="font-medium">{stats.pendingPayments}</span>
              </div>
            </div>
          </CardContent>
        </Card>
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
