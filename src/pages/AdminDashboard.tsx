
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, RefreshCw } from "lucide-react";
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
      {/* Header */}
      <AdminHeader
        title="Admin Dashboard"
        subtitle="Enhanced System Overview with Real-time Monitoring"
        icon={<Shield className="h-5 w-5 text-accent-blue" />}
      >
        <Button onClick={refetch} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Enhanced System Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-enhanced-heading">System Overview</h2>
          <EnhancedStatsCards stats={stats} isLoading={isLoading} />
        </div>

        {/* Payment System Status */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-enhanced-heading">Payment System Health</h2>
          <PaymentSystemStatus fawranStats={stats.fawranStats} />
        </div>

        {/* Fawran System Diagnostics - Only show if no payments detected */}
        {stats.fawranStats.totalPayments === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-enhanced-heading">System Diagnostics</h2>
            <FawranSystemTest />
          </div>
        )}

        {/* Recent Activity with Scroll */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-enhanced-heading">Recent Activity</h2>
          <ScrollableRecentActivity activities={recentActivity} isLoading={isLoading} />
        </div>
        
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
