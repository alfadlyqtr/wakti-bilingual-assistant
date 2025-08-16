
import { Shield, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats";
import { EnhancedStatsCards } from "@/components/admin/EnhancedStatsCards";
import { ScrollableRecentActivity } from "@/components/admin/ScrollableRecentActivity";
import { PaymentSystemStatus } from "@/components/admin/PaymentSystemStatus";
import { FawranStatsCards } from "@/components/admin/FawranStatsCards";
import { FawranSystemTest } from "@/components/admin/FawranSystemTest";

export default function AdminDashboard() {
  const { stats, recentActivity, isLoading, refetch } = useAdminDashboardStats();

  const autoApprovalRate = stats.fawranStats.totalPayments > 0 
    ? Math.round((stats.fawranStats.autoApprovedPayments / stats.fawranStats.totalPayments) * 100)
    : 0;

  const avgProcessingTime = Math.round(stats.fawranStats.avgProcessingTimeMs / 1000) || 0;

  return (
    <div className="min-h-screen bg-[#0c0f14] text-white/90">
      <AdminHeader
        title="Admin Dashboard"
        subtitle="Enhanced System Overview"
        icon={<Shield className="h-5 w-5 text-white/70" />}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 truncate"
            title="Live Updates"
          >
            <TrendingUp className="h-3 w-3" />
            Live Updates
          </span>
          <Button onClick={refetch} variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
            <RefreshCw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </AdminHeader>

      {/* Main Content */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6 sm:space-y-8">
        {/* Recent Activity - MOVED TO TOP */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse"></div>
              Recent Activity
            </h2>
            <div className="text-xs text-white/50">
              Live updates • Last refresh: {new Date().  toLocaleTimeString()}
            </div>
          </div>
          <ScrollableRecentActivity activities={recentActivity} isLoading={isLoading} />
        </div>

        {/* Enhanced System Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white/90">System Overview</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 bg-accent-green rounded-full"></div>
              <span>All Systems Operational</span>
            </div>
          </div>
          <EnhancedStatsCards stats={stats} isLoading={isLoading} />
        </div>

        {/* Enhanced Payment System Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white/90">Payment System Health</h2>
            <div className="text-xs text-muted-foreground">
              Auto-approval: {autoApprovalRate}% • Avg processing: {avgProcessingTime}s
            </div>
          </div>
          <PaymentSystemStatus fawranStats={stats.fawranStats} />
        </div>

        {/* Fawran System Diagnostics - Only show if no payments detected */}
        {stats.fawranStats.totalPayments === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white/90">System Diagnostics</h2>
            <FawranSystemTest />
          </div>
        )}
        
        {/* Detailed Fawran Stats */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90">Fawran Payment Intelligence</h2>
          <FawranStatsCards 
            stats={stats.fawranStats} 
            autoApprovalRate={autoApprovalRate}
            avgProcessingTime={avgProcessingTime}
            isLoading={isLoading} 
          />
        </div>
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
