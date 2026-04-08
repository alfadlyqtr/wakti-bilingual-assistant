import { createContext, useState, useEffect, useCallback } from 'react';
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
  subscription_status?: string | null;
  plan_name?: string | null;
  free_access_start_at?: string | null;
  revenuecat_id?: string | null;
  trial_popup_shown?: boolean | null;
  payment_method?: string | null;
  next_billing_date?: string | null;
}

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createProfileIfMissing: (userId: string) => Promise<UserProfile>;
  isSubscribed: boolean;
  isAdminGifted: boolean;
  isGracePeriod: boolean;
  hasTrialStarted: boolean;
  hasSeenTrialPopup: boolean;
  isAccessExpired: boolean;
  isNewUser: boolean;
  wasSubscribed: boolean;
}

export const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const IS_DEV = !import.meta.env.PROD;

  const normalizeAvatarUrl = (url: string | null | undefined) => {
    const raw = (url || '').trim();
    if (!raw) return null;
    const normalized = raw.replace(/^(%20)+/i, '').trim();
    return normalized || null;
  };

  const createProfileIfMissing = useCallback(async (userId: string): Promise<UserProfile> => {
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
  }, [user, IS_DEV]);

  const fetchProfile = useCallback(async () => {
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
          if (IS_DEV) console.debug('Profile not found, creating new profile...');
          const newProfile = await createProfileIfMissing(user.id);
          setProfile(newProfile);
        } else {
          console.error('Error fetching profile:', error);
          setError(error.message);
        }
      } else {
        if (IS_DEV) console.debug('Profile fetched successfully:', data);

        if (data?.avatar_url) {
          const normalized = normalizeAvatarUrl(data.avatar_url);
          if (normalized && normalized !== data.avatar_url) {
            try {
              await supabase
                .from('profiles')
                .update({ avatar_url: normalized })
                .eq('id', user.id);
              data.avatar_url = normalized;
            } catch {}
          }
        }

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
  }, [user?.id, user?.email, user?.user_metadata, IS_DEV, createProfileIfMissing]);

  useEffect(() => {
    fetchProfile();

    const handleProfileUpdate = () => fetchProfile();
    window.addEventListener('wakti-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('wakti-profile-updated', handleProfileUpdate);
  }, [fetchProfile]);

  // Single Realtime channel for profile changes — one per app lifetime
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `profile-changes-${user.id}`;

    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
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
  }, [user?.id, IS_DEV]);

  const isSubscribed = profile?.is_subscribed ?? false;

  const isAdminGifted = (() => {
    if ((profile as any)?.admin_gifted === true) return true;
    const pm = profile?.payment_method;
    if (!pm || pm === 'manual') return false;
    if (!profile?.next_billing_date) return false;
    return new Date(profile.next_billing_date) > new Date();
  })();

  const isGracePeriod = (() => {
    if (profile?.is_subscribed) return false;
    if ((profile as any)?.admin_gifted === true) return false;
    const pm = profile?.payment_method;
    if (pm && pm !== 'manual' && profile?.next_billing_date && new Date(profile.next_billing_date) > new Date()) return false;
    const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
    if (start == null) return false;
    const elapsedMin = Math.floor((Date.now() - start) / 60000);
    return elapsedMin < 1440;
  })();

  const hasTrialStarted = profile?.free_access_start_at != null;

  const hasSeenTrialPopup = profile?.trial_popup_shown ?? false;

  const isAccessExpired = (() => {
    if (profile?.is_subscribed) return false;
    if ((profile as any)?.admin_gifted === true) return false;
    const pm = profile?.payment_method;
    if (pm && pm !== 'manual' && profile?.next_billing_date && new Date(profile.next_billing_date) > new Date()) return false;
    const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
    if (start == null) return false;
    const elapsedMin = Math.floor((Date.now() - start) / 60000);
    return elapsedMin >= 1440;
  })();

  const isNewUser = !profile?.free_access_start_at && !profile?.is_subscribed && !profile?.plan_name;

  const wasSubscribed = !profile?.is_subscribed && !!profile?.plan_name;

  const value: UserProfileContextValue = {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    createProfileIfMissing,
    isSubscribed,
    isAdminGifted,
    isGracePeriod,
    hasTrialStarted,
    hasSeenTrialPopup,
    isAccessExpired,
    isNewUser,
    wasSubscribed,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
