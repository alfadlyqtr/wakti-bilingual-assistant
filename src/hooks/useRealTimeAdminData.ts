import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  pendingMessages: number;
  onlineUsers: number;
  monthlyRevenue: number;
  newUsersToday: number;
}

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
    activeSubscriptions: 0,
    pendingMessages: 0,
    onlineUsers: 0,
    monthlyRevenue: 0,
    newUsersToday: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      // Load total users (exclude suspended/deleted ones)
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('display_name', '[DELETED USER]')
        .eq('is_suspended', false);

      // Load active subscriptions from profiles table
      const { data: activeSubscriptionData, count: activeSubscriptions } = await supabase
        .from('profiles')
        .select('plan_name, is_subscribed, subscription_status, billing_start_date', { count: 'exact' })
        .eq('is_subscribed', true)
        .eq('subscription_status', 'active')
        .neq('display_name', '[DELETED USER]');

      // Load pending messages
      const { count: pendingMessages } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

      // Load online users (users who are currently logged in)
      const { count: onlineUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_logged_in', true)
        .neq('display_name', '[DELETED USER]');

      // Calculate monthly revenue from active subscriptions (fixed calculation)
      let monthlyRevenue = 0;
      if (activeSubscriptionData && activeSubscriptionData.length > 0) {
        monthlyRevenue = activeSubscriptionData.reduce((sum, profile) => {
          // Skip admin-gifted subscriptions (they don't contribute to revenue)
          if (profile.plan_name?.toLowerCase().includes('gift') || 
              profile.plan_name?.toLowerCase().includes('admin')) {
            return sum;
          }
          
          // Calculate amount based on plan name - Fixed amounts
          const isYearly = profile.plan_name?.toLowerCase().includes('yearly') || 
                           profile.plan_name?.toLowerCase().includes('year');
          const amount = isYearly ? 600 : 60; // 600 QAR yearly, 60 QAR monthly
          return sum + amount;
        }, 0);
      }

      // Load new users today
      const today = new Date().toISOString().split('T')[0];
      const { count: newUsersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`)
        .neq('display_name', '[DELETED USER]');

      setStats({
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        pendingMessages: pendingMessages || 0,
        onlineUsers: onlineUsers || 0,
        monthlyRevenue,
        newUsersToday: newUsersToday || 0
      });

      console.log('Admin stats loaded:', {
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        monthlyRevenue,
        pendingMessages: pendingMessages || 0,
        onlineUsers: onlineUsers || 0
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
      toast.error('Failed to load admin statistics');
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent user registrations with email confirmation status (limit to 3)
      const { data: newUsers } = await supabase
        .from('profiles')
        .select('email, created_at, email_confirmed')
        .neq('display_name', '[DELETED USER]')
        .order('created_at', { ascending: false })
        .limit(3);

      newUsers?.forEach(user => {
        const emailStatus = user.email_confirmed ? 'confirmed' : 'not confirmed yet';
        activities.push({
          id: `user-${user.created_at}`,
          type: 'user_registration',
          message: `New user registration: ${user.email} (email ${emailStatus})`,
          timestamp: user.created_at,
          status: user.email_confirmed ? 'success' : 'warning'
        });
      });

      // Sort by timestamp and limit to 3 activities total
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 3));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadStats(), loadRecentActivity()]);
      setIsLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const statsInterval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    const activityInterval = setInterval(loadRecentActivity, 60000); // Refresh every minute

    // Set up real-time listeners for immediate updates
    const profilesSubscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadStats();
        loadRecentActivity();
      })
      .subscribe();

    const contactsSubscription = supabase
      .channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_submissions' }, () => {
        loadStats();
        loadRecentActivity();
      })
      .subscribe();

    return () => {
      clearInterval(statsInterval);
      clearInterval(activityInterval);
      supabase.removeChannel(profilesSubscription);
      supabase.removeChannel(contactsSubscription);
    };
  }, []);

  return {
    stats,
    recentActivity,
    isLoading,
    refetch: async () => {
      await Promise.all([loadStats(), loadRecentActivity()]);
    }
  };
};
