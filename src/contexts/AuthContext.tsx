import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { purchasesLogin, purchasesLogout, purchasesWarmup } from '@/integrations/natively/purchasesBridge';
import { setNotificationUser, removeNotificationUser, requestNotificationPermission, setupNotificationClickHandler } from '@/integrations/natively/notificationsBridge';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  lastLoginTimestamp: number | null; // Timestamp of last successful login
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  forgotPassword: (email: string) => Promise<{ error: any }>; // Alias for resetPassword
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<{ error: any }>;
  updateEmail: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  // Expose setters to allow manual context update when auth events don't fire
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLastLoginTimestamp: React.Dispatch<React.SetStateAction<number | null>>;
}

// SAFE default for when AuthProvider is not mounted (e.g., admin/public routes)
const defaultAuthContextValue: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  isLoading: false,
  lastLoginTimestamp: null,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  forgotPassword: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  updateEmail: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  setUser: () => {},
  setSession: () => {},
  setLoading: () => {},
  setLastLoginTimestamp: () => {},
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  // IMPORTANT: Do NOT throw. Return an inert default when outside AuthProvider (admin/public trees).
  return context ?? defaultAuthContextValue;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoginTimestamp, setLastLoginTimestamp] = useState<number | null>(null);

  // Warm up Natively Purchases SDK if present (no-op on web)
  useEffect(() => {
    try { purchasesWarmup(); } catch {}
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let loadingTimer: number;

    // Fallback: if getSession() hangs, re-check session and only then allow loading to finish.
    // IMPORTANT: Do not clear tokens here; the goal is to avoid false logouts on refresh.
    loadingTimer = window.setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session.user ?? null);
        }
      } catch (error) {
        console.warn('AuthContext: getSession() fallback check failed:', error);
      } finally {
        console.log('AuthContext: Finishing loading state after fallback timeout.');
        setLoading(false);
      }
    }, 15000);

    // 1) Try to get initial session with graceful 400/401 error handling
    try {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          console.log('AuthContext: getSession() succeeded.');
          window.clearTimeout(loadingTimer);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        })
        .catch((error) => {
          console.error('AuthContext: getSession() promise failed:', error);
          window.clearTimeout(loadingTimer);
          
          // Gracefully handle 400/401 errors (invalid tokens)
          // Clear storage and set logged out state without showing error
          if (error?.status === 400 || error?.status === 401 || 
              error?.message?.includes('Invalid Refresh Token') ||
              error?.message?.includes('refresh_token')) {
            console.log('[Auth] Clearing invalid session tokens');
            try {
              // Clear all auth storage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('wakti-auth');
                for (const store of [localStorage, sessionStorage]) {
                  const keys: string[] = [];
                  for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    if (k?.startsWith('sb-')) keys.push(k);
                  }
                  keys.forEach(k => store.removeItem(k));
                }
              }
            } catch {}
            setSession(null);
            setUser(null);
          }
          
          setLoading(false);
        });
    } catch (error) {
      console.error('AuthContext: getSession() threw synchronous error:', error);
      window.clearTimeout(loadingTimer);
      setLoading(false);
    }

    // 2) Always subscribe to auth changes
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        
        // === PART 2: RESPECT MANUAL AUTH LOCK ===
        if ((window as any).__MANUAL_AUTH_LOCK) {
          if (event === 'SIGNED_IN' && !session) {
            console.warn('AuthContext: Ignoring unreliable NULL session event post-login.');
            return; // IGNORE THE BAD EVENT
          }
          // Unlock after 5 seconds
          setTimeout(() => { (window as any).__MANUAL_AUTH_LOCK = false; }, 5000);
        }
        // ========================================
        
        // Auth state changed (only log errors, not every event)
        window.clearTimeout(loadingTimer);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });
      subscription = data.subscription;
    } catch (error) {
      console.error('CRITICAL: Failed to subscribe to onAuthStateChange', error);
      window.clearTimeout(loadingTimer);
      setLoading(false);
    }

    // 3) Cleanup
    return () => {
      try { window.clearTimeout(loadingTimer); } catch {}
      try { subscription?.unsubscribe(); } catch {}
    };
  }, []);

  // Track when the Natively SDK finishes loading inside the WebView
  const [nativelyReady, setNativelyReady] = useState<boolean>(
    typeof window !== 'undefined' ? Boolean((window as any).__nativelyReady) : false
  );

  const handleNativelyReady = useCallback(() => {
    setNativelyReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__nativelyReady) {
      setNativelyReady(true);
      return;
    }
    window.addEventListener('natively-ready', handleNativelyReady);
    return () => {
      window.removeEventListener('natively-ready', handleNativelyReady);
    };
  }, [handleNativelyReady]);

  // Sync timezone to profile for localized notifications (runs for ALL users, web + native)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        supabase.rpc('update_user_timezone' as any, { 
          p_user_id: user.id, 
          p_timezone: tz 
        }).then(({ error }) => {
          if (error) console.warn('[AuthContext] Timezone sync failed:', error);
        });
      }
    } catch (tzErr) {
      console.warn('[AuthContext] Failed to get client timezone:', tzErr);
    }
  }, [user?.id]);

  // === SINGLE-DEVICE LOGIN: Realtime Session Monitoring ===
  // Uses Supabase Realtime to instantly detect when user logs in on another device
  // No polling required - server pushes changes to client via WebSocket
  useEffect(() => {
    if (!user?.id || !session?.access_token) return;
    
    console.log('[AuthContext] Setting up realtime single-device session monitoring');
    
    // Subscribe to changes on this user's session record
    const channel = supabase
      .channel(`user-session-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_active_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Check if the session ID changed (someone logged in elsewhere)
          const newSessionId = (payload.new as any)?.session_id;
          
          if (newSessionId && newSessionId !== session.access_token) {
            console.log('[AuthContext] Session replaced by another device (realtime)');
            toast.info('You have been signed out because you logged in on another device');
            
            // Unsubscribe first to prevent any further events
            supabase.removeChannel(channel);
            
            // Clear session and redirect to login
            supabase.auth.signOut({ scope: 'local' as any }).catch(() => {});
            setUser(null);
            setSession(null);
            
            // Redirect to login
            try {
              window.location.replace('/login');
            } catch {}
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AuthContext] Realtime session monitoring active');
        }
      });
    
    // Cleanup subscription on unmount or dependency change
    return () => {
      console.log('[AuthContext] Cleaning up realtime session monitoring');
      supabase.removeChannel(channel);
    };
  }, [user?.id, session?.access_token]);

  // Identify logged-in user in RevenueCat (via Natively SDK). No-op on web.
  // Also check subscription status via RevenueCat REST API
  useEffect(() => {
    if (!nativelyReady) return;
    try {
      if (user?.id) {
        purchasesLogin(user.id, user.email || '');
        
        // Request push notification permission first (required by Natively/OneSignal)
        // This registers the device with OneSignal, then we set the external ID
        requestNotificationPermission(true); // true = show alert to open settings if previously denied
        
        // Set external ID to link this device to the user for targeted push notifications
        // Two attempts with staggered delays to handle SDK timing races
        setTimeout(() => {
          console.log('[AuthContext] Setting notification user ID (attempt 1):', user.id);
          setNotificationUser(user.id);
        }, 2000);
        setTimeout(() => {
          console.log('[AuthContext] Setting notification user ID (attempt 2 - retry):', user.id);
          setNotificationUser(user.id);
        }, 6000);
        
        // Check subscription status via Edge Function (calls RevenueCat REST API)
        // This ensures we have accurate subscription state after login
        supabase.functions.invoke('check-subscription', {
          body: { userId: user.id }
        }).then(({ data, error }) => {
          if (error) {
            console.warn('[AuthContext] Subscription check failed:', error);
          } else {
            console.log('[AuthContext] Subscription check result:', data);
          }
        }).catch(err => {
          console.warn('[AuthContext] Subscription check error:', err);
        });
      } else {
        purchasesLogout();
        // NOTE: Do NOT call removeNotificationUser() here.
        // This effect fires on transient auth nulls (token refresh, session blips).
        // Unlinking the OneSignal external_id here causes "not subscribed" errors
        // and the "burst then dead" push pattern. Only unlink on explicit signOut().
      }
    } catch (error) {
      console.warn('AuthContext: Natively identify failed', error);
    }
  }, [nativelyReady, user?.id, user?.email]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast.error(error.message);
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for the confirmation link!');
    }
    
    return { error };
  };

  const signOut = async () => {
    // Revoke refresh token globally to avoid instant re-login from other tabs/devices
    const { error } = await supabase.auth.signOut({ scope: 'global' as any });
    if (error && !/auth session missing/i.test(error.message)) {
      toast.error(error.message);
    }
    // Detach user identity from RevenueCat on native builds (no-op on web)
    try { purchasesLogout(); } catch {}
    try { removeNotificationUser(); } catch {}
    // Clear any app-level cached flags that might drive auto-login flows
    try {
      localStorage.removeItem('admin_session');
      // Best-effort cleanup of any legacy flags your app may set
      localStorage.removeItem('wakti_session_kicked');
      localStorage.removeItem('wakti_session_blocked');
      // Remove Supabase auth caches so SDK cannot auto-restore
      for (const store of [localStorage, sessionStorage]) {
        try {
          const keys: string[] = [];
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (!k) continue;
            if (k.startsWith('sb-') || k.startsWith('wakti-auth')) keys.push(k);
          }
          keys.forEach((k) => store.removeItem(k));
        } catch {}
      }
    } catch {}
    setUser(null);
    setSession(null);
    try {
      window.location.replace('/');
    } catch {}
  };

  const resetPassword = async (email: string) => {
    // Determine the correct redirect URL based on environment
    const baseUrl = window.location.origin;
    const redirectTo = `${baseUrl}/auth/confirm`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email for the reset link!');
    }
    
    return { error };
  };

  const updateProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
    const { error } = await supabase.auth.updateUser({
      data: updates
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated successfully!');
    }
    
    return { error };
  };

  const updateEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email to confirm the change!');
    }
    
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
    }
    
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    isLoading: loading, // Alias for loading
    lastLoginTimestamp,
    signIn,
    signUp,
    signOut,
    resetPassword,
    forgotPassword: resetPassword, // Alias for resetPassword
    updateProfile,
    updateEmail,
    updatePassword,
    setUser,
    setSession,
    setLoading,
    setLastLoginTimestamp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
