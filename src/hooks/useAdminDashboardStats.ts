// @ts-nocheck
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminDashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  giftSubscriptions: number;
  expiringSoon: number;
  unsubscribedUsers: number;
  unconfirmedAccounts: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  pendingMessages: number;
  
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'subscription_activation' | 'subscription_expiry' | 'payment_received' | 'gift_given';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info' | 'error';
}

export const useAdminDashboardStats = () => {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    giftSubscriptions: 0,
    expiringSoon: 0,
    unsubscribedUsers: 0,
    unconfirmedAccounts: 0,
    monthlyRevenue: 0,
    newUsersThisMonth: 0,
    pendingMessages: 0
  });
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      console.log('[DEBUG] Fetching admin dashboard stats...');
      
      // Get main dashboard stats using the new SQL function
      const { data: dashboardStats, error: dashboardError } = await supabase.rpc('get_admin_dashboard_stats');
      if (dashboardError) {
        console.error('[DEBUG] Dashboard stats error:', dashboardError);
        throw dashboardError;
      }

      const mainStats = dashboardStats?.[0] || {};

      setStats({
        totalUsers: mainStats.total_users || 0,
        activeSubscriptions: mainStats.active_subscriptions || 0,
        giftSubscriptions: mainStats.gift_subscriptions || 0,
        expiringSoon: mainStats.expiring_soon || 0,
        unsubscribedUsers: mainStats.unsubscribed_users || 0,
        unconfirmedAccounts: mainStats.unconfirmed_accounts || 0,
        monthlyRevenue: Number(mainStats.monthly_revenue) || 0,
        newUsersThisMonth: mainStats.new_users_this_month || 0,
        pendingMessages: mainStats.pending_messages || 0
      });

      console.log('[DEBUG] Stats updated successfully:', {
        totalUsers: mainStats.total_users,
        giftSubscriptions: mainStats.gift_subscriptions,
        expiringSoon: mainStats.expiring_soon,
        monthlyRevenue: mainStats.monthly_revenue
      });

    } catch (error) {
      console.error('[DEBUG] Error fetching admin stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent subscription activations from admin activity logs
      const { data: recentSubs } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .in('action', ['subscription_activated', 'gift_subscription_activated', 'automatic_subscription_expiry'])
        .order('created_at', { ascending: false })
        .limit(10);

      recentSubs?.forEach(log => {
        const details = log.details as any;
        if (log.action === 'subscription_activated') {
          activities.push({
            id: log.id,
            type: 'subscription_activation',
            message: `Subscription activated for ${details?.user_email || 'user'}`,
            timestamp: log.created_at,
            status: 'success'
          });
        } else if (log.action === 'gift_subscription_activated') {
          activities.push({
            id: log.id,
            type: 'gift_given',
            message: `Gift subscription given to ${details?.user_email || 'user'} (${details?.gift_duration || 'unknown duration'})`,
            timestamp: log.created_at,
            status: 'success'
          });
        } else if (log.action === 'automatic_subscription_expiry') {
          activities.push({
            id: log.id,
            type: 'subscription_expiry',
            message: `${details?.expired_count || 0} subscriptions expired automatically`,
            timestamp: log.created_at,
            status: 'warning'
          });
        }
      });

      // Get recent user signups (limit to confirmed users)
      const { data: newUsers } = await supabase
        .from('profiles')
        .select('email, created_at')
        .neq('display_name', '[DELETED USER]')
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      newUsers?.forEach(user => {
        activities.push({
          id: user.email + user.created_at,
          type: 'user_registration',
          message: `New user registered: ${user.email}`,
          timestamp: user.created_at,
          status: 'info'
        });
      });

      // Get recent Fawran payments
      const { data: fawranPayments } = await supabase
        .from('pending_fawran_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      fawranPayments?.forEach(payment => {
        activities.push({
          id: payment.id,
          type: 'payment_received',
          message: `Fawran payment: ${payment.email} - ${payment.amount} QAR (${payment.status})`,
          timestamp: payment.created_at,
          status: payment.status === 'approved' ? 'success' : 
                  payment.status === 'rejected' ? 'error' : 'warning'
        });
      });

      // Sort all activities by timestamp and limit to 15 most recent
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 15));

    } catch (error) {
      console.error('[DEBUG] Error fetching recent activity:', error);
    }
  };

  const refetch = async () => {
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchRecentActivity()]);
    setIsLoading(false);
  };

  useEffect(() => {
    refetch();
    
    // Set up real-time subscriptions for live updates
    const profilesSubscription = supabase
      .channel('admin-profiles-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('[DEBUG] Profiles updated, refreshing stats...');
          refetch();
        }
      )
      .subscribe();

    const subscriptionsSubscription = supabase
      .channel('admin-subscriptions-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => {
          console.log('[DEBUG] Subscriptions updated, refreshing stats...');
          refetch();
        }
      )
      .subscribe();

    const fawranSubscription = supabase
      .channel('admin-fawran-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pending_fawran_payments' },
        () => {
          console.log('[DEBUG] Fawran payments updated, refreshing stats...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      profilesSubscription.unsubscribe();
      subscriptionsSubscription.unsubscribe();
      fawranSubscription.unsubscribe();
    };
  }, []);

  return {
    stats,
    recentActivity,
    isLoading,
    refetch
  };
};
