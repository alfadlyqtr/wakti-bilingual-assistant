
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Add alias for backwards compatibility
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>; // Add signOut method
  updateProfile: (data: any) => Promise<void>; // Add for Account page
  updateEmail: (email: string) => Promise<void>; // Add for Account page
  updatePassword: (password: string) => Promise<void>; // Add for Account page
  forgotPassword: (email: string) => Promise<void>; // Add for ForgotPassword page
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting logout process...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        toast.error('Failed to logout');
        throw error;
      }
      
      console.log('Logout completed successfully');
      toast.success('Logged out successfully');
      
    } catch (error) {
      console.error('Error during logout:', error);
      toast.error('Failed to logout');
      throw error;
    }
  };

  const updateProfile = async (data: any) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data
      });
      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  const updateEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success('Email updated successfully');
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error('Failed to update email');
      throw error;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast.error('Failed to send reset email');
      throw error;
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes - simplified without complex session tracking
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        // Simple session tracking without complex enforcement
        try {
          await supabase
            .from('user_sessions')
            .upsert({
              user_id: session.user.id,
              session_token: session.access_token,
              device_info: navigator.userAgent.substring(0, 200),
              is_active: true
            });
        } catch (error) {
          console.warn('Could not track user session:', error);
          // Don't block login if session tracking fails
        }
      }

      if (event === 'SIGNED_OUT') {
        // Simple cleanup on logout
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            await supabase
              .from('user_sessions')
              .update({ is_active: false })
              .eq('user_id', userData.user.id);
          }
        } catch (error) {
          console.warn('Could not update session on logout:', error);
          // Don't block logout if cleanup fails
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    session,
    loading,
    isLoading: loading, // Alias for backwards compatibility
    refreshSession,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword,
    forgotPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
