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
  fawranStats: {
    totalPayments: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    autoApprovedPayments: number;
    manualReviewedPayments: number;
    avgProcessingTimeMs: number;
    tamperingDetected: number;
    duplicateDetected: number;
    timeValidationFailed: number;
  };
  paymentMethodDistribution: {
    fawran: number;
    manual: number;
    gift: number;
  };
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
    pendingMessages: 0,
    fawranStats: {
      totalPayments: 0,
      pendingPayments: 0,
      approvedPayments: 0,
      rejectedPayments: 0,
      autoApprovedPayments: 0,
      manualReviewedPayments: 0,
      avgProcessingTimeMs: 0,
      tamperingDetected: 0,
      duplicateDetected: 0,
      timeValidationFailed: 0
    },
    paymentMethodDistribution: { fawran: 0, manual: 0, gift: 0 }
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

      // Get Fawran payment stats using the new SQL function
      const { data: fawranStats, error: fawranError } = await supabase.rpc('get_fawran_payment_stats');
      if (fawranError) {
        console.error('[DEBUG] Fawran stats error:', fawranError);
        throw fawranError;
      }

      // Get payment method distribution using the new SQL function
      const { data: paymentMethodData, error: paymentError } = await supabase.rpc('get_payment_method_stats');
      if (paymentError) {
        console.error('[DEBUG] Payment method stats error:', paymentError);
        throw paymentError;
      }

      const mainStats = dashboardStats?.[0] || {};
      const fawranStatsData = fawranStats?.[0] || {};
      
      // Process payment method distribution
      const paymentMethodDistribution = { fawran: 0, manual: 0, gift: 0 };
      paymentMethodData?.forEach((method: any) => {
        if (method.payment_method === 'fawran') {
          paymentMethodDistribution.fawran = method.user_count;
        } else if (method.payment_method === 'gift') {
          paymentMethodDistribution.gift = method.user_count;
        } else {
          paymentMethodDistribution.manual += method.user_count;
        }
      });

      setStats({
        totalUsers: mainStats.total_users || 0,
        activeSubscriptions: mainStats.active_subscriptions || 0,
        giftSubscriptions: mainStats.gift_subscriptions || 0,
        expiringSoon: mainStats.expiring_soon || 0,
        unsubscribedUsers: mainStats.unsubscribed_users || 0,
        unconfirmedAccounts: mainStats.unconfirmed_accounts || 0,
        monthlyRevenue: Number(mainStats.monthly_revenue) || 0,
        newUsersThisMonth: mainStats.new_users_this_month || 0,
        pendingMessages: mainStats.pending_messages || 0,
        fawranStats: {
          totalPayments: fawranStatsData.total_payments || 0,
          pendingPayments: fawranStatsData.pending_payments || 0,
          approvedPayments: fawranStatsData.approved_payments || 0,
          rejectedPayments: fawranStatsData.rejected_payments || 0,
          autoApprovedPayments: fawranStatsData.auto_approved_payments || 0,
          manualReviewedPayments: fawranStatsData.manual_reviewed_payments || 0,
          avgProcessingTimeMs: Number(fawranStatsData.avg_processing_time_ms) || 0,
          tamperingDetected: fawranStatsData.tampering_detected_count || 0,
          duplicateDetected: fawranStatsData.duplicate_detected_count || 0,
          timeValidationFailed: fawranStatsData.time_validation_failed_count || 0
        },
        paymentMethodDistribution
      });

      console.log('[DEBUG] Stats updated successfully:', {
        totalUsers: mainStats.total_users,
        giftSubscriptions: mainStats.gift_subscriptions,
        expiringSoon: mainStats.expiring_soon,
        monthlyRevenue: mainStats.monthly_revenue,
        fawranPayments: fawranStatsData.total_payments
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
