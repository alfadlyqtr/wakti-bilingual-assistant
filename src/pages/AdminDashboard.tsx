
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { stats, recentActivity, isLoading, refetch } = useAdminDashboardStats();

  useEffect(() => {
    validateAdminSession();
  }, []);

  const validateAdminSession = async () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      navigate('/mqtr');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        navigate('/mqtr');
        return;
      }
    } catch (err) {
      navigate('/mqtr');
    }
  };

  const autoApprovalRate = stats.fawranStats.totalPayments > 0 
    ? Math.round((stats.fawranStats.autoApprovedPayments / stats.fawranStats.totalPayments) * 100)
    : 0;

  const avgProcessingTime = Math.round(stats.fawranStats.avgProcessingTimeMs / 1000) || 0;

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border-b border-border/50">
        <AdminHeader
          title="Admin Dashboard"
          subtitle="Enhanced System Overview with Real-time Monitoring & Analytics"
          icon={<Shield className="h-5 w-5 text-accent-blue" />}
        >
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Live Updates</span>
            </div>
            <Button onClick={refetch} variant="outline" size="sm" className="text-xs">
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </AdminHeader>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Recent Activity - MOVED TO TOP */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-enhanced-heading flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse"></div>
              Recent Activity
            </h2>
            <div className="text-xs text-muted-foreground">
              Live updates • Last refresh: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <ScrollableRecentActivity activities={recentActivity} isLoading={isLoading} />
        </div>

        {/* Enhanced System Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-enhanced-heading">System Overview</h2>
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
            <h2 className="text-xl font-semibold text-enhanced-heading">Payment System Health</h2>
            <div className="text-xs text-muted-foreground">
              Auto-approval: {autoApprovalRate}% • Avg processing: {avgProcessingTime}s
            </div>
          </div>
          <PaymentSystemStatus fawranStats={stats.fawranStats} />
        </div>

        {/* Fawran System Diagnostics - Only show if no payments detected */}
        {stats.fawranStats.totalPayments === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-enhanced-heading">System Diagnostics</h2>
            <FawranSystemTest />
          </div>
        )}
        
        {/* Detailed Fawran Stats */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-enhanced-heading">Fawran Payment Intelligence</h2>
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
