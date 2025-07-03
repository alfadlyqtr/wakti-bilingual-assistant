import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { useRealTimeAdminData } from "@/hooks/useRealTimeAdminData";
import { RealTimeStatsCards } from "@/components/admin/RealTimeStatsCards";
import { FawranStatsCards } from "@/components/admin/FawranStatsCards";
import { RealTimeActivityFeed } from "@/components/admin/RealTimeActivityFeed";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { stats, recentActivity, isLoading, refetch } = useRealTimeAdminData();

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

  // Enhanced stats mapping with gift subscriptions
  const enhancedStats = {
    totalUsers: stats.totalUsers,
    activeSubscriptions: stats.subscribedUsers,
    pendingMessages: stats.pendingMessages,
    onlineUsers: stats.activeUsers,
    monthlyRevenue: stats.monthlyRevenue,
    newUsersToday: stats.newUsersThisMonth,
    giftSubscriptions: stats.giftSubscriptions
  };

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Header */}
      <AdminHeader
        title="Admin Dashboard"
        subtitle="Real-time system monitoring and management"
        icon={<Shield className="h-5 w-5 text-accent-blue" />}
      >
        <Button onClick={refetch} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Enhanced Stats Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-enhanced-heading">System Overview</h2>
            <Badge variant="outline" className="text-accent-green border-accent-green">
              Live Data
            </Badge>
          </div>
          <RealTimeStatsCards stats={enhancedStats} isLoading={isLoading} />
        </div>

        {/* Real-Time Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-enhanced-heading">Recent Activity</h2>
            <Badge variant="secondary">
              Last Updated: {new Date().toLocaleTimeString()}
            </Badge>
          </div>
          <RealTimeActivityFeed activity={recentActivity} isLoading={isLoading} />
        </div>
        
        {/* Enhanced Fawran Payment Stats */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-enhanced-heading flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent-cyan" />
            Payment Intelligence + Gifts
          </h2>
          <FawranStatsCards stats={stats.fawranStats} isLoading={isLoading} />
        </div>
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
