
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  avatar_url?: string;
  display_name?: string;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  country_code?: string;
  updated_at?: string;
  settings?: {
    widgets?: {
      showCalendarWidget?: boolean;
      showTasksWidget?: boolean;
      showTRWidget?: boolean;
      showMaw3dWidget?: boolean;
      showQuoteWidget?: boolean;
    };
    notifications?: any;
    privacy?: any;
    quotes?: any;
  };
}

interface BatchedUserData {
  profile: UserProfile | null;
  widgetSettings: {
    showCalendarWidget: boolean;
    showTasksWidget: boolean;
    showTRWidget: boolean;
    showMaw3dWidget: boolean;
    showQuoteWidget: boolean;
  };
}

export function useBatchedUserData() {
  const { user } = useAuth();
  const [data, setData] = useState<BatchedUserData>({
    profile: null,
    widgetSettings: {
      showCalendarWidget: true,
      showTasksWidget: true,
      showTRWidget: true,
      showMaw3dWidget: true,
      showQuoteWidget: true,
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createProfileIfMissing = async (userId: string) => {
    try {
      console.log('Creating missing profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: `user${userId.substring(0, 8)}`,
          display_name: user?.email || 'User',
          email: user?.email,
          country: user?.user_metadata?.country || null,
          country_code: user?.user_metadata?.country_code || null,
          settings: {
            widgets: {
              showCalendarWidget: true,
              showTasksWidget: true,
              showTRWidget: true,
              showMaw3dWidget: true,
              showQuoteWidget: true
            },
            notifications: {
              pushNotifications: true,
              emailNotifications: false
            },
            privacy: {
              profileVisibility: true,
              activityStatus: true
            },
            quotes: {
              category: 'mixed',
              frequency: 'daily'
            }
          }
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        throw error;
      }

      console.log('Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw error;
    }
  };

  // BATCHED user data fetching - combines profile and settings into single query
  const fetchBatchedUserData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching batched user data for user:', user.id);
      
      // Single query that gets profile with settings in one call
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          console.log('Profile not found, creating new profile...');
          const newProfile = await createProfileIfMissing(user.id);
          
          const widgetSettings = {
            showCalendarWidget: true,
            showTasksWidget: true,
            showTRWidget: true,
            showMaw3dWidget: true,
            showQuoteWidget: true,
          };

          setData({
            profile: newProfile,
            widgetSettings
          });
        } else {
          console.error('Error fetching profile:', error);
          setError(error.message);
        }
      } else {
        console.log('✅ Batched user data fetched successfully:', profile);
        
        // Extract widget settings from profile.settings
        const dbSettings = profile?.settings?.widgets || {};
        const widgetSettings = {
          showCalendarWidget: dbSettings.showCalendarWidget !== false,
          showTasksWidget: dbSettings.showTasksWidget !== false,
          showTRWidget: dbSettings.showTRWidget !== false,
          showMaw3dWidget: dbSettings.showMaw3dWidget !== false,
          showQuoteWidget: dbSettings.showQuoteWidget !== false,
        };

        setData({
          profile,
          widgetSettings
        });
      }
    } catch (err) {
      console.error('❌ Batched user data fetch error:', err);
      setError('Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBatchedUserData();
  }, [fetchBatchedUserData]);

  // Set up real-time subscription for profile changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated in real-time:', payload);
          if (payload.new) {
            const updatedProfile = payload.new as UserProfile;
            const dbSettings = updatedProfile?.settings?.widgets || {};
            const widgetSettings = {
              showCalendarWidget: dbSettings.showCalendarWidget !== false,
              showTasksWidget: dbSettings.showTasksWidget !== false,
              showTRWidget: dbSettings.showTRWidget !== false,
              showMaw3dWidget: dbSettings.showMaw3dWidget !== false,
              showQuoteWidget: dbSettings.showQuoteWidget !== false,
            };

            setData({
              profile: updatedProfile,
              widgetSettings
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    profile: data.profile,
    widgetSettings: data.widgetSettings,
    loading,
    error,
    refetch: fetchBatchedUserData,
    createProfileIfMissing
  };
}
