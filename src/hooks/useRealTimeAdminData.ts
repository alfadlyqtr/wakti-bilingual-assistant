
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
      // Load total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Load active subscriptions
      const { count: activeSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Load pending messages
      const { count: pendingMessages } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

      // Load online users
      const { count: onlineUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_logged_in', true);

      // Calculate monthly revenue
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { data: monthlySubscriptions } = await supabase
        .from('subscriptions')
        .select('billing_amount')
        .eq('status', 'active')
        .gte('created_at', `${currentMonth}-01`);

      const monthlyRevenue = monthlySubscriptions?.reduce((sum, sub) => 
        sum + (Number(sub.billing_amount) || 0), 0) || 0;

      // Load new users today
      const today = new Date().toISOString().split('T')[0];
      const { count: newUsersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      setStats({
        totalUsers: totalUsers || 0,
        activeSubscriptions: activeSubscriptions || 0,
        pendingMessages: pendingMessages || 0,
        onlineUsers: onlineUsers || 0,
        monthlyRevenue,
        newUsersToday: newUsersToday || 0
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
      toast.error('Failed to load admin statistics');
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent user registrations
      const { data: newUsers } = await supabase
        .from('profiles')
        .select('email, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      newUsers?.forEach(user => {
        activities.push({
          id: `user-${user.created_at}`,
          type: 'user_registration',
          message: `New user registration: ${user.email}`,
          timestamp: user.created_at,
          status: 'success'
        });
      });

      // Get recent subscription activations - Fix the email access issue
      const { data: newSubs } = await supabase
        .from('subscriptions')
        .select('created_at, profiles!inner(email)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(2);

      newSubs?.forEach(sub => {
        const profileEmail = (sub.profiles as any)?.email || 'Unknown user';
        activities.push({
          id: `sub-${sub.created_at}`,
          type: 'subscription_activation',
          message: `Subscription activated: ${profileEmail}`,
          timestamp: sub.created_at,
          status: 'success'
        });
      });

      // Get recent contact submissions
      const { data: contacts } = await supabase
        .from('contact_submissions')
        .select('name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(2);

      contacts?.forEach(contact => {
        activities.push({
          id: `contact-${contact.created_at}`,
          type: 'contact_submission',
          message: `New contact form: ${contact.name} (${contact.email})`,
          timestamp: contact.created_at,
          status: 'info'
        });
      });

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 5));
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

    const subscriptionsSubscription = supabase
      .channel('subscriptions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
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
      supabase.removeChannel(subscriptionsSubscription);
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
