import { createContext, useState, useEffect, useCallback, useRef } from 'react';
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
  created_at?: string;
  updated_at?: string;
  last_seen?: string | null;
  // Subscription/grace fields
  is_subscribed: boolean;
  subscription_status?: string | null;
  plan_name?: string | null;
  free_access_start_at?: string | null;
  revenuecat_id?: string | null;
  trial_popup_shown?: boolean | null;
  payment_method?: string | null;
  next_billing_date?: string | null;
  billing_start_date?: string | null;
  admin_gifted?: boolean;
  // Trial usage tracking
  trial_usage?: any;
  // Settings & preferences
  settings?: any;
  notification_preferences?: any;
  auto_approve_contacts?: boolean;
  custom_tags?: any;
  calendar_feed_token?: string | null;
  is_logged_in?: boolean;
  language?: string | null;
}

// ── Item #7 (Stage 7A): single source of truth for access decisions ──
// These types are exported so ProtectedRoute / Account.tsx / CustomPaywallModal
// can eventually swap their local math for a single read from this context.
export type PaywallVariantName = 'new_user' | 'cancelled' | 'trial_expired';
export type AccessState =
  | 'loading'
  | 'subscribed'
  | 'admin_gifted'
  | 'trial_active'
  | 'paywall:new_user'
  | 'paywall:cancelled'
  | 'paywall:trial_expired';

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createProfileIfMissing: (userId: string) => Promise<UserProfile>;
  applyFreshProfile: (data: UserProfile) => void;
  isSubscribed: boolean;
  isAdminGifted: boolean;
  isGracePeriod: boolean;
  hasTrialStarted: boolean;
  hasSeenTrialPopup: boolean;
  isAccessExpired: boolean;
  isNewUser: boolean;
  wasSubscribed: boolean;
  // ── Item #7 Stage 7A: new derived values (read-only, no consumer yet) ──
  hasBillingGrace: boolean;
  paywallVariant: PaywallVariantName | null;
  accessState: AccessState;
}

export const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

const PROFILE_CACHE_KEY = (uid: string) => `wakti_profile_${uid}`;
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Always returns cached data if it exists — regardless of TTL.
// Staleness is checked separately so we can show stale data instantly
// and refresh in the background.
function readCachedProfile(uid: string): { data: UserProfile; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY(uid));
    if (!raw) return null;
    const { data, _cachedAt } = JSON.parse(raw);
    if (!data) return null;
    const stale = !_cachedAt || (Date.now() - _cachedAt > PROFILE_CACHE_TTL);
    return { data: data as UserProfile, stale };
  } catch { return null; }
}

function writeCachedProfile(uid: string, data: UserProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY(uid), JSON.stringify({ data, _cachedAt: Date.now() }));
  } catch { /* quota exceeded or tracking prevention — non-fatal */ }
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Start with null — we'll hydrate reactively once user.id is known
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  // Start loading=true; cleared as soon as we have ANY data (cache or fresh)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const IS_DEV = !import.meta.env.PROD;

  const updateProfile = (p: UserProfile | null) => {
    profileRef.current = p;
    setProfile(p);
    if (p && user?.id) writeCachedProfile(user.id, p);
  };

  const applyFreshProfile = useCallback((data: UserProfile) => {
    profileRef.current = data;
    setProfile(data);
    if (user?.id) writeCachedProfile(user.id, data);
    setLoading(false);
    setError(null);
  }, [user?.id]);

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
  }, [user?.id, user?.email, user?.user_metadata?.country, user?.user_metadata?.country_code, user?.user_metadata?.city, IS_DEV]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // ── Stale-first: show cache immediately, even if expired ──────────────
    const cached = readCachedProfile(user.id);
    if (cached) {
      // Hydrate instantly — UI renders NOW, no spinner
      if (profileRef.current === null) {
        profileRef.current = cached.data;
        setProfile(cached.data);
        setLoading(false);
      }
      // If fresh, skip the network round-trip entirely
      if (!cached.stale) return;
    }
    // ─────────────────────────────────────────────────────────────────────

    try {
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
          updateProfile(newProfile);
        } else {
          console.error('Error fetching profile:', error);
          // Only set error if we have no cached data to fall back on
          if (!cached) setError(error.message);
        }
      } else {
        if (IS_DEV) console.debug('Profile fetched successfully:', data);
        updateProfile(data);

        // ── Defer non-critical writes (avatar normalization, country sync)
        // These happen AFTER the UI is already rendered — no blocking
        setTimeout(async () => {
          if (data?.avatar_url) {
            const normalized = normalizeAvatarUrl(data.avatar_url);
            if (normalized && normalized !== data.avatar_url) {
              try {
                await supabase
                  .from('profiles')
                  .update({ avatar_url: normalized })
                  .eq('id', user.id);
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
              updateProfile({
                ...data,
                country: user.user_metadata.country,
                country_code: user.user_metadata.country_code || null,
                city: data.city || user.user_metadata.city || null
              });
            }
          }
        }, 0);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      if (!cached) setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, user?.user_metadata?.country, IS_DEV, createProfileIfMissing]);

  useEffect(() => {
    fetchProfile();

    // Listen for BOTH events directly here (Stage 7C).
    // No re-dispatch chain needed — both events simply trigger a profile refetch.
    const handleProfileUpdate = () => fetchProfile();
    window.addEventListener('wakti-profile-updated', handleProfileUpdate);
    window.addEventListener('wakti-subscription-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('wakti-profile-updated', handleProfileUpdate);
      window.removeEventListener('wakti-subscription-updated', handleProfileUpdate);
    };
  }, [fetchProfile]);

  // ── Item #7 Stage 7C: RevenueCat sync lives here now (moved from AuthContext) ──
  // Fires once per logged-in user. Syncs profiles.is_subscribed with RC, then lets
  // the existing realtime listener propagate any DB changes to consumers.
  // Why here: it's a profile-level concern (it writes to the profile row), so it
  // belongs next to the code that owns the profile.
  const rcSyncedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) {
      rcSyncedUserRef.current = null;
      return;
    }
    if (rcSyncedUserRef.current === user.id) return; // already synced this user
    rcSyncedUserRef.current = user.id;

    if (IS_DEV) console.log('[UserProfileContext] Checking subscription status with RevenueCat...');
    supabase.functions.invoke('check-subscription', { body: { userId: user.id } })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[UserProfileContext] Subscription check failed:', error);
          return;
        }
        if (IS_DEV) console.log('[UserProfileContext] Subscription check result:', data);
        // If RC confirmed subscribed, refetch the profile so any DB update lands in UI.
        // (Realtime will usually fire too; refetch is belt-and-suspenders.)
        if (data?.isSubscribed) fetchProfile();
      })
      .catch((err) => {
        console.warn('[UserProfileContext] Subscription check error:', err);
      });
  }, [user?.id, IS_DEV, fetchProfile]);

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
            updateProfile(payload.new as UserProfile);
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
    if (profile?.admin_gifted === true) return true;
    const pm = profile?.payment_method;
    if (!pm || pm === 'manual') return false;
    if (!profile?.next_billing_date) return false;
    return new Date(profile.next_billing_date) > new Date();
  })();

  const isGracePeriod = (() => {
    if (profile?.is_subscribed) return false;
    if (profile?.admin_gifted === true) return false;
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
    if (profile?.admin_gifted === true) return false;
    const pm = profile?.payment_method;
    if (pm && pm !== 'manual' && profile?.next_billing_date && new Date(profile.next_billing_date) > new Date()) return false;
    const start = profile?.free_access_start_at ? Date.parse(profile.free_access_start_at) : null;
    if (start == null) return false;
    const elapsedMin = Math.floor((Date.now() - start) / 60000);
    return elapsedMin >= 1440;
  })();

  const isNewUser = !profile?.free_access_start_at && !profile?.is_subscribed && !profile?.plan_name;

  const wasSubscribed = !profile?.is_subscribed && !!profile?.plan_name;

  // ── Item #7 Stage 7A: new derived values (observational, no consumer yet) ──
  // Observational flag: paid user whose next_billing_date passed within the last 24h.
  // Does NOT affect access today (isSubscribed=true already grants access via
  // the 4-Keys gate). Kept here so ProtectedRoute/Account can see the billing
  // state at a glance, and so logs/analytics can flag "renewal is slow".
  const hasBillingGrace = (() => {
    if (!profile?.is_subscribed) return false;
    if (!profile?.next_billing_date) return false;
    const nextBilling = new Date(profile.next_billing_date);
    const now = new Date();
    if (now <= nextBilling) return false;
    const graceEnd = new Date(nextBilling);
    graceEnd.setDate(graceEnd.getDate() + 1);
    return now <= graceEnd;
  })();

  // Paywall variant selection — priority: cancelled > trial_expired > new_user.
  // Returns null when the user has access (no paywall needed).
  // Matches the existing priority used in ProtectedRoute.tsx and Account.tsx.
  const paywallVariant: PaywallVariantName | null = (() => {
    if (isSubscribed || isAdminGifted || isGracePeriod) return null;
    if (wasSubscribed) return 'cancelled';
    if (isAccessExpired) return 'trial_expired';
    if (isNewUser) return 'new_user';
    return null;
  })();

  // Single access-state enum — the "one brain" output.
  // Packages existing booleans into a clean value ProtectedRoute can consume
  // in Stage 7B. Adds no new behavior: same inputs, same decisions.
  const accessState: AccessState = (() => {
    if (!profile) return 'loading';
    if (isSubscribed) return 'subscribed';
    if (isAdminGifted) return 'admin_gifted';
    if (isGracePeriod) return 'trial_active';
    if (paywallVariant === 'cancelled') return 'paywall:cancelled';
    if (paywallVariant === 'trial_expired') return 'paywall:trial_expired';
    if (paywallVariant === 'new_user') return 'paywall:new_user';
    return 'loading';
  })();

  // DEV-only: log accessState transitions so Stage 7A can be verified
  // in the wild before Stage 7B starts consuming it.
  const lastAccessStateRef = useRef<AccessState | null>(null);
  useEffect(() => {
    if (!IS_DEV) return;
    if (lastAccessStateRef.current !== accessState) {
      lastAccessStateRef.current = accessState;
      console.log('[UserProfileContext] accessState →', accessState, {
        paywallVariant,
        hasBillingGrace,
        isSubscribed,
        isAdminGifted,
        isGracePeriod,
      });
    }
  }, [accessState, paywallVariant, hasBillingGrace, isSubscribed, isAdminGifted, isGracePeriod]);

  const value: UserProfileContextValue = {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    createProfileIfMissing,
    applyFreshProfile,
    isSubscribed,
    isAdminGifted,
    isGracePeriod,
    hasTrialStarted,
    hasSeenTrialPopup,
    isAccessExpired,
    isNewUser,
    wasSubscribed,
    hasBillingGrace,
    paywallVariant,
    accessState,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
