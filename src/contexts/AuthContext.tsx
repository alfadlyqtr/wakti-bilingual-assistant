
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes with rate limiting protection
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      // Prevent rapid state changes during token refresh
      if (event === 'TOKEN_REFRESHED' && isRefreshing) {
        console.log('⚠️ Token refresh already in progress, skipping...');
        return;
      }
      
      if (event === 'TOKEN_REFRESHED') {
        setIsRefreshing(true);
        // Reset refresh flag after a delay
        setTimeout(() => setIsRefreshing(false), 2000);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, services will initialize after delay');
        // Services will be initialized by useUnreadMessages with a delay
      }

      if (event === 'SIGNED_OUT') {
        console.log('User signed out, cleaning up...');
        setUser(null);
        setSession(null);
        setIsRefreshing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isRefreshing]);

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
