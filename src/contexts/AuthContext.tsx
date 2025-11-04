import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  // Expose setters to allow manual context update when auth events don't fire
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
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
  setUser: () => {},
  setSession: () => {},
  setLoading: () => {},
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

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    let loadingTimer: number;

    // Force loading=false after 2s if getSession() hangs
    loadingTimer = window.setTimeout(() => {
      console.log('AuthContext: Forcing loading state to false after timeout.');
      setLoading(false);
    }, 2000);

    // 1) Try to get initial session (but don't rely on it)
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
        console.log('AuthContext: onAuthStateChange event fired:', event);
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
    setUser,
    setSession,
    setLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
