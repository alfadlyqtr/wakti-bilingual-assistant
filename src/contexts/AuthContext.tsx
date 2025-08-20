import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  forgotPassword: (email: string) => Promise<{ error: any }>; // Alias for resetPassword
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<{ error: any }>;
  updateEmail: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

// SAFE default for when AuthProvider is not mounted (e.g., admin/public routes)
const defaultAuthContextValue: AuthContextType = {
  user: null,
  session: null,
  loading: false,
  isLoading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  forgotPassword: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  updateEmail: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
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
  const lockChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localNonceRef = useRef<string | null>(null);

  const getNonceStorageKey = (userId: string) => `wakti_session_nonce_${userId}`;

  const cleanupSessionLock = (userId?: string) => {
    if (lockChannelRef.current) {
      supabase.removeChannel(lockChannelRef.current);
      lockChannelRef.current = null;
    }
    if (userId) {
      try { localStorage.removeItem(getNonceStorageKey(userId)); } catch {}
    }
    localNonceRef.current = null;
  };

  const subscribeToSessionLock = (userId: string) => {
    if (lockChannelRef.current) {
      supabase.removeChannel(lockChannelRef.current);
      lockChannelRef.current = null;
    }
    const channel = supabase
      .channel(`session-lock-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_session_locks', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newNonce = (payload.new as any)?.nonce;
          const current = localNonceRef.current;
          if (newNonce && current && newNonce !== current) {
            // Another session has taken the lock; sign out here.
            toast.info('Your account was signed in elsewhere. You have been signed out on this device.');
            try { localStorage.setItem('wakti_session_kicked', '1'); } catch {}
            supabase.auth.signOut();
          }
        }
      )
      .subscribe();
    lockChannelRef.current = channel;
    console.log('[Auth] SessionLock: subscribed to user_session_locks for', userId);
  };

  const claimSessionLock = async (userId: string, forceNewNonce: boolean) => {
    try {
      // Prepare or reuse our local nonce first (but DO NOT claim yet)
      let nonce: string | null = null;
      const storageKey = getNonceStorageKey(userId);
      if (!forceNewNonce) {
        try { nonce = localStorage.getItem(storageKey); } catch {}
      }
      if (!nonce) {
        nonce = uuidv4();
        try { localStorage.setItem(storageKey, nonce); } catch {}
      }
      localNonceRef.current = nonce;

      // 1) Subscribe FIRST to avoid missing any future changes
      subscribeToSessionLock(userId);

      // Fresh login: do NOT take over immediately. We'll check current owner first below.
      // If another device owns the lock, this device will be blocked and signed out.

      // 2) Immediate post-subscribe safety check: if another session already owns the lock, sign out
      const { data: existing, error: fetchErr } = await supabase
        .from('user_session_locks')
        .select('nonce')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('[Auth] SessionLock: safety check fetch error (continuing):', fetchErr);
      }

      const existingNonce = existing?.nonce as string | undefined;
      if (existingNonce && existingNonce !== nonce) {
        if (forceNewNonce) {
          console.log('[Auth] SessionLock: existing lock detected on fresh login → blocking this device');
          // Immediately sign out to prevent dashboard access
          await supabase.auth.signOut();
          // Throw error to prevent any further auth processing
          throw new Error('BLOCKED_FRESH_LOGIN');
        } else {
          console.log('[Auth] SessionLock: post-subscribe mismatch detected. Existing:', existingNonce, 'Local:', nonce, '→ signing out');
          toast.info('Your account was signed in elsewhere. You have been signed out on this device.');
          try { localStorage.setItem('wakti_session_kicked', '1'); } catch {}
          await supabase.auth.signOut();
        }
        return;
      }

      // 3) Only claim the lock if:
      // - This is NOT a fresh login (persisted session restoration), OR
      // - This IS a fresh login but no conflicting lock exists
      if (!forceNewNonce || !existingNonce) {
        const { error: upsertErr } = await supabase
          .from('user_session_locks')
          .upsert({ user_id: userId, nonce }, { onConflict: 'user_id' });

        if (upsertErr) {
          console.error('[Auth] Failed to claim session lock (upsert):', upsertErr);
        } else {
          console.log('[Auth] SessionLock: claimed with nonce', nonce);
        }
      } else {
        console.log('[Auth] SessionLock: skipping claim due to existing lock on fresh login');
      }
    } catch (e) {
      console.error('[Auth] Failed to claim session lock:', e);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        // Ensure we have/claim a lock for persisted sessions without forcing a new nonce
        claimSessionLock(session.user.id, false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, initializing services...');
        // Claim the session lock with a fresh nonce to enforce single active session
        await claimSessionLock(session.user.id, true);
        // Services will be initialized by useUnreadMessages in AppLayout
      }

      if (event === 'SIGNED_OUT') {
        console.log('User signed out, cleaning up...');
        const lastUserId = user?.id;
        setUser(null);
        setSession(null);
        if (lastUserId) cleanupSessionLock(lastUserId);
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed for user:', session?.user?.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
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
    signIn,
    signUp,
    signOut,
    resetPassword,
    forgotPassword: resetPassword, // Alias for resetPassword
    updateProfile,
    updateEmail,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
