import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface AnalyticsData {
  totalRevenue: number;
  monthlyRevenue: number;
  totalUsers: number;
  newUsersThisMonth: number;
  activeSubscriptions: number;
  subscriptionGrowth: number;
  dailyActiveUsers: number;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalUsers: 0,
    newUsersThisMonth: 0,
    activeSubscriptions: 0,
    subscriptionGrowth: 0,
    dailyActiveUsers: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();

      // Total Users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // New Users This Month
      const { count: newUsersThisMonth } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstDayOfMonth);

      // Active Subscriptions
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Daily Active Users (logged in today)
      const today = new Date().toISOString().split('T')[0];
      const { count: dailyActiveUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_logged_in', true);

      // Revenue calculations
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('amount, created_at')
        .eq('status', 'active');

      const totalRevenue = subscriptions?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0;
      const monthlyRevenue = subscriptions?.filter(sub => 
        new Date(sub.created_at) >= new Date(firstDayOfMonth)
      ).reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0;

      // Previous month for growth calculation
      const prevMonthStart = new Date(currentYear, currentMonth - 2, 1).toISOString();
      const { count: prevMonthSubs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('created_at', prevMonthStart)
        .lt('created_at', firstDayOfMonth);

      const subscriptionGrowth = prevMonthSubs && prevMonthSubs > 0 
        ? ((activeSubscriptions! - prevMonthSubs) / prevMonthSubs) * 100 
        : 0;

      setAnalytics({
        totalRevenue,
        monthlyRevenue,
        totalUsers: totalUsers || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        activeSubscriptions: activeSubscriptions || 0,
        subscriptionGrowth,
        dailyActiveUsers: dailyActiveUsers || 0
      });

    } catch (err) {
      console.error('Error loading analytics:', err);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background text-foreground">
      <AdminHeader
        title="Analytics Dashboard"
        subtitle="Revenue tracking and user analytics"
        icon={<BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-accent-cyan" />}
      />

      <div className="p-3 sm:p-6 pb-24 space-y-6 sm:space-y-8">
        {/* Revenue Analytics */}
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-enhanced-heading mb-4 sm:mb-6">Revenue Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-accent-green" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">
                  {analytics.totalRevenue.toFixed(2)} QAR
                </div>
                <p className="text-xs text-muted-foreground mt-1">All-time revenue</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-accent-blue" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">
                  {analytics.monthlyRevenue.toFixed(2)} QAR
                </div>
                <p className="text-xs text-muted-foreground mt-1">This month's revenue</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* User Analytics */}
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-enhanced-heading mb-4 sm:mb-6">User Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-accent-blue" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">{analytics.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered users</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">New Users</CardTitle>
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-accent-green" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">{analytics.newUsersThisMonth}</div>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Daily Active</CardTitle>
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-accent-orange" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">{analytics.dailyActiveUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Online today</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Active Subs</CardTitle>
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-accent-purple" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-3xl font-bold text-enhanced-heading">{analytics.activeSubscriptions}</div>
                <p className="text-xs text-muted-foreground mt-1">Paying customers</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Growth Metrics */}
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-enhanced-heading mb-4 sm:mb-6">Growth Metrics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading">Subscription Growth</CardTitle>
                <CardDescription>Month-over-month subscription growth</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-xl sm:text-2xl font-bold text-enhanced-heading">
                    {analytics.subscriptionGrowth > 0 ? '+' : ''}{analytics.subscriptionGrowth.toFixed(1)}%
                  </div>
                  <TrendingUp className={`h-4 w-4 sm:h-5 sm:w-5 ${analytics.subscriptionGrowth >= 0 ? 'text-accent-green' : 'text-red-500'}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.subscriptionGrowth >= 0 ? 'Growing' : 'Declining'} compared to last month
                </p>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading">User Engagement</CardTitle>
                <CardDescription>Daily active users percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-xl sm:text-2xl font-bold text-enhanced-heading">
                    {analytics.totalUsers > 0 ? ((analytics.dailyActiveUsers / analytics.totalUsers) * 100).toFixed(1) : 0}%
                  </div>
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent-blue" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.dailyActiveUsers} of {analytics.totalUsers} users active today
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">Quick Summary</CardTitle>
            <CardDescription>Key performance indicators at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="text-base sm:text-lg font-semibold text-enhanced-heading">
                  {((analytics.activeSubscriptions / analytics.totalUsers) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Conversion Rate</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="text-base sm:text-lg font-semibold text-enhanced-heading">
                  {analytics.activeSubscriptions > 0 ? (analytics.totalRevenue / analytics.activeSubscriptions).toFixed(0) : 0} QAR
                </div>
                <div className="text-xs text-muted-foreground">Avg Revenue per User</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="text-base sm:text-lg font-semibold text-enhanced-heading">
                  {analytics.totalUsers > 0 ? ((analytics.dailyActiveUsers / analytics.totalUsers) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">Daily Engagement</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="text-base sm:text-lg font-semibold text-enhanced-heading">
                  {analytics.newUsersThisMonth}
                </div>
                <div className="text-xs text-muted-foreground">Monthly Growth</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
