
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  isTokenRefreshing: boolean;
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
  const [isTokenRefreshing, setIsTokenRefreshing] = useState(false);

  useEffect(() => {
    let isInitialLoad = true;
    let tokenRefreshTimeout: NodeJS.Timeout;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Only set loading to false after initial load
      if (isInitialLoad) {
        setLoading(false);
        isInitialLoad = false;
      }
    });

    // Listen for auth changes with improved token refresh handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);
      
      // Handle token refresh events
      if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed, setting refresh state');
        setIsTokenRefreshing(true);
        
        // Clear existing timeout
        if (tokenRefreshTimeout) {
          clearTimeout(tokenRefreshTimeout);
        }
        
        // Reset refresh flag after delay
        tokenRefreshTimeout = setTimeout(() => {
          setIsTokenRefreshing(false);
          console.log('✅ Token refresh state cleared');
        }, 3000);
        
        // Update session but don't change loading state during refresh
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }
      
      // Handle other auth events normally
      setSession(session);
      setUser(session?.user ?? null);
      
      // Always set loading to false after auth events (except token refresh)
      if (event !== 'TOKEN_REFRESHED') {
        setLoading(false);
      }

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in successfully:', session.user.email);
        // Longer delay for services to initialize after login
        setTimeout(() => {
          console.log('🚀 User session stabilized, services can initialize');
        }, 5000);
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setSession(null);
        setIsTokenRefreshing(false);
        if (tokenRefreshTimeout) {
          clearTimeout(tokenRefreshTimeout);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (tokenRefreshTimeout) {
        clearTimeout(tokenRefreshTimeout);
      }
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
    isTokenRefreshing,
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
