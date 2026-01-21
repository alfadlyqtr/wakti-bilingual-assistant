
import { useState, useEffect } from 'react';
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
  city?: string;
  updated_at?: string;
  // Subscription/grace fields
  is_subscribed: boolean;
  free_access_start_at?: string | null;
  revenuecat_id?: string | null;
  trial_popup_shown?: boolean | null;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const IS_DEV = !import.meta.env.PROD;

  const createProfileIfMissing = async (userId: string) => {
    try {
      if (IS_DEV) console.debug('Creating missing profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: `user${userId.substring(0, 8)}`,
          display_name: user?.email || 'User',
          email: user?.email,
          country: user?.user_metadata?.country || null,
          country_code: user?.user_metadata?.country_code || null,
          city: user?.user_metadata?.city || null,
          settings: {
            widgets: {
              tasksWidget: true,
              calendarWidget: true,
              remindersWidget: true,
              quoteWidget: true
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

      if (IS_DEV) console.debug('Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw error;
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (IS_DEV) console.debug('Fetching profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          if (IS_DEV) console.debug('Profile not found, creating new profile...');
          const newProfile = await createProfileIfMissing(user.id);
          setProfile(newProfile);
        } else {
          console.error('Error fetching profile:', error);
          setError(error.message);
        }
      } else {
        if (IS_DEV) console.debug('Profile fetched successfully:', data);
        
        // If profile exists but country is missing, sync from user_metadata
        // This handles the case where the DB trigger didn't include country
        if (!data.country && user?.user_metadata?.country) {
          if (IS_DEV) console.debug('Syncing country from user_metadata to profile');
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              country: user.user_metadata.country,
              country_code: user.user_metadata.country_code || null,
              city: data.city || user.user_metadata.city || null
            })
            .eq('id', user.id);
          
          if (!updateError) {
            data.country = user.user_metadata.country;
            data.country_code = user.user_metadata.country_code || null;
            data.city = data.city || user.user_metadata.city || null;
          }
        }
        
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

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
          // Gate verbose logs in production to avoid exposing profile payload in user consoles
          if (IS_DEV) console.debug('Profile updated (realtime):', { eventType: payload.eventType, when: payload.commit_timestamp });
          if (payload.new) {
            setProfile(payload.new as UserProfile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    createProfileIfMissing,
    // Access flags
    get isSubscribed() {
      return (profile?.is_subscribed ?? false);
    },
    get isGracePeriod() {
      const isSubscribed = (profile?.is_subscribed ?? false);
      if (isSubscribed) return false;
      const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
      if (start == null) return false; // NOT STARTED = not grace, not expired
      const elapsedMin = Math.floor((Date.now() - start) / 60000);
      return elapsedMin < 1440; // 24 hours
    },
    get hasTrialStarted() {
      return profile?.free_access_start_at != null;
    },
    get hasSeenTrialPopup() {
      return profile?.trial_popup_shown ?? false;
    },
    get isAccessExpired() {
      const isSubscribed = (profile?.is_subscribed ?? false);
      if (isSubscribed) return false;
      const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
      if (start == null) return false; // not set counts as grace, not expired
      const elapsedMin = Math.floor((Date.now() - start) / 60000);
      return elapsedMin >= 1440; // 24 hours
    }
  };
}
