
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  subscribedUsers: number;
  pendingMessages: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  pendingFawranPayments: number;
  autoApprovalRate: number;
  avgProcessingTime: number;
  giftSubscriptions: number;
  paymentMethodDistribution: {
    fawran: number;
    manual: number;
    gift: number;
  };
  fawranStats: {
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
}

interface AdminActivity {
  id: string;
  type: 'user_signup' | 'subscription_activated' | 'fawran_payment' | 'message_received' | 'gift_given';
  title: string;
  description: string;
  timestamp: string;
  user_email?: string;
  amount?: number;
  status?: string;
}

// Convert AdminActivity to RecentActivity format for compatibility
interface RecentActivity {
  id: string;
  type: 'user_registration' | 'subscription_activation' | 'contact_submission' | 'task_creation';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

export const useRealTimeAdminData = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    subscribedUsers: 0,
    pendingMessages: 0,
    monthlyRevenue: 0,
    newUsersThisMonth: 0,
    pendingFawranPayments: 0,
    autoApprovalRate: 0,
    avgProcessingTime: 0,
    giftSubscriptions: 0,
    paymentMethodDistribution: { fawran: 0, manual: 0, gift: 0 },
    fawranStats: {
      totalPayments: 0,
      pendingPayments: 0,
      approvedPayments: 0,
      rejectedPayments: 0,
      autoApprovedPayments: 0,
      manualReviewedPayments: 0,
      tamperingDetected: 0,
      duplicateDetected: 0,
      timeValidationFailed: 0
    }
  });
  
  const [recentActivity, setRecentActivity] = useState<AdminActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Get basic user stats
      const { data: userStats } = await supabase
        .from('profiles')
        .select('*')
        .neq('display_name', '[DELETED USER]');

      const totalUsers = userStats?.length || 0;
      const activeUsers = userStats?.filter(u => u.is_logged_in).length || 0;
      const subscribedUsers = userStats?.filter(u => u.is_subscribed && u.subscription_status === 'active').length || 0;

      // Get gift subscriptions count
      const { data: giftSubs } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('is_gift', true)
        .eq('status', 'active');

      const giftSubscriptions = giftSubs?.length || 0;

      // Get monthly revenue
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('billing_amount')
        .eq('status', 'active');

      const monthlyRevenue = subscriptions?.reduce((sum, sub) => sum + Number(sub.billing_amount), 0) || 0;

      // Get new users this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: newUsers } = await supabase
        .from('profiles')
        .select('id')
        .gte('created_at', startOfMonth.toISOString());

      const newUsersThisMonth = newUsers?.length || 0;

      // Get pending messages
      const { data: messages } = await supabase
        .from('contact_submissions')
        .select('id')
        .eq('status', 'unread');

      const pendingMessages = messages?.length || 0;

      // Get Fawran statistics
      const { data: fawranStatsData } = await supabase.rpc('get_fawran_payment_stats');
      const fawranStats = fawranStatsData?.[0] || {
        total_payments: 0,
        pending_payments: 0,
        approved_payments: 0,
        rejected_payments: 0,
        auto_approved_payments: 0,
        manual_reviewed_payments: 0,
        avg_processing_time_ms: 0,
        tampering_detected_count: 0,
        duplicate_detected_count: 0,
        time_validation_failed_count: 0
      };

      // Get payment method distribution (Clean version - NO PayPal)
      const { data: paymentMethodData } = await supabase.rpc('get_payment_method_stats');
      const paymentMethodDistribution = {
        fawran: 0,
        manual: 0,
        gift: 0
      };

      paymentMethodData?.forEach((method: any) => {
        if (method.payment_method === 'fawran') {
          paymentMethodDistribution.fawran = method.user_count;
        } else if (method.payment_method === 'gift') {
          paymentMethodDistribution.gift = method.user_count;
        } else {
          // All other methods (manual, legacy, etc.) are grouped as manual
          paymentMethodDistribution.manual += method.user_count;
        }
      });

      // Calculate auto-approval rate
      const autoApprovalRate = fawranStats.total_payments > 0 
        ? Math.round((fawranStats.auto_approved_payments / fawranStats.total_payments) * 100)
        : 0;

      setStats({
        totalUsers,
        activeUsers,
        subscribedUsers,
        pendingMessages,
        monthlyRevenue,
        newUsersThisMonth,
        pendingFawranPayments: fawranStats.pending_payments,
        autoApprovalRate,
        avgProcessingTime: Math.round(fawranStats.avg_processing_time_ms / 1000) || 0,
        giftSubscriptions,
        paymentMethodDistribution,
        fawranStats: {
          totalPayments: fawranStats.total_payments,
          pendingPayments: fawranStats.pending_payments,
          approvedPayments: fawranStats.approved_payments,
          rejectedPayments: fawranStats.rejected_payments,
          autoApprovedPayments: fawranStats.auto_approved_payments,
          manualReviewedPayments: fawranStats.manual_reviewed_payments,
          tamperingDetected: fawranStats.tampering_detected_count,
          duplicateDetected: fawranStats.duplicate_detected_count,
          timeValidationFailed: fawranStats.time_validation_failed_count
        }
      });

    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const activities: AdminActivity[] = [];

      // Get recent gift subscriptions from admin activity logs
      const { data: giftActivities } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('action', 'gift_subscription_activated')
        .order('created_at', { ascending: false })
        .limit(3);

      giftActivities?.forEach(activity => {
        const details = activity.details as any;
        activities.push({
          id: activity.id,
          type: 'gift_given',
          title: 'Gift Subscription Given',
          description: `${details?.user_email} - ${details?.gift_duration?.replace('_', ' ')} gift`,
          timestamp: activity.created_at,
          user_email: details?.user_email,
          status: 'active'
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
          type: 'fawran_payment',
          title: 'Fawran Payment Received',
          description: `${payment.email} - ${payment.amount} QAR (${payment.plan_type})`,
          timestamp: payment.created_at,
          user_email: payment.email,
          amount: payment.amount,
          status: payment.status
        });
      });

      // Get recent user signups
      const { data: newUsers } = await supabase
        .from('profiles')
        .select('email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      newUsers?.forEach(user => {
        if (user.email) {
          activities.push({
            id: user.email + user.created_at,
            type: 'user_signup',
            title: 'New User Signup',
            description: user.email,
            timestamp: user.created_at,
            user_email: user.email
          });
        }
      });

      // Get recent subscription activations
      const { data: recentSubs } = await supabase
        .from('subscriptions')
        .select('*, profiles!inner(email)')
        .order('created_at', { ascending: false })
        .limit(5);

      recentSubs?.forEach(sub => {
        activities.push({
          id: sub.id,
          type: 'subscription_activated',
          title: sub.is_gift ? 'Gift Subscription Activated' : 'Subscription Activated',
          description: `${(sub.profiles as any)?.email} - ${sub.plan_name}`,
          timestamp: sub.created_at,
          user_email: (sub.profiles as any)?.email,
          amount: sub.billing_amount
        });
      });

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setRecentActivity(activities.slice(0, 10));

    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const refetch = async () => {
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchRecentActivity()]);
    setIsLoading(false);
  };

  useEffect(() => {
    refetch();
    
    // Set up real-time subscriptions
    const fawranSubscription = supabase
      .channel('admin-fawran-payments')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pending_fawran_payments' },
        () => refetch()
      )
      .subscribe();

    const profilesSubscription = supabase
      .channel('admin-profiles')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => refetch()
      )
      .subscribe();

    const subscriptionsSubscription = supabase
      .channel('admin-subscriptions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => refetch()
      )
      .subscribe();

    return () => {
      fawranSubscription.unsubscribe();
      profilesSubscription.unsubscribe();
      subscriptionsSubscription.unsubscribe();
    };
  }, []);

  // Convert AdminActivity to RecentActivity format for RealTimeActivityFeed compatibility
  const convertedRecentActivity: RecentActivity[] = recentActivity.map(activity => ({
    id: activity.id,
    type: activity.type === 'user_signup' ? 'user_registration' as const : 
          activity.type === 'subscription_activated' ? 'subscription_activation' as const :
          activity.type === 'gift_given' ? 'subscription_activation' as const :
          activity.type === 'fawran_payment' ? 'contact_submission' as const : 'task_creation' as const,
    message: activity.title + (activity.description ? ` - ${activity.description}` : ''),
    timestamp: activity.timestamp,
    status: activity.type === 'fawran_payment' ? 'warning' as const : 
            activity.type === 'subscription_activated' ? 'success' as const :
            activity.type === 'gift_given' ? 'success' as const : 'info' as const
  }));

  return {
    stats,
    recentActivity: convertedRecentActivity,
    isLoading,
    refetch
  };
};
