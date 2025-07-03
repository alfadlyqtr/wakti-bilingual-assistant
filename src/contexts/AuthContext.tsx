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
      
      // Clear local state first - this ensures UI updates immediately
      setSession(null);
      setUser(null);
      
      // Attempt to sign out from server
      const { error } = await supabase.auth.signOut();
      
      // Handle different error types
      if (error) {
        // Check if it's a session-not-found error (which is actually success)
        if (error.message?.includes('session') || 
            error.message?.includes('Session not found') ||
            error.message?.includes('session id') ||
            error.status === 403) {
          console.log('Session already expired - logout successful');
          toast.success('Logged out successfully');
          return; // This is actually a successful logout
        }
        
        // Only throw for real errors (not session-related)
        console.error('Real logout error:', error);
        toast.error('Failed to logout completely, but you are logged out locally');
        return; // Still return successfully since local state is cleared
      }
      
      console.log('Logout completed successfully');
      toast.success('Logged out successfully');
      
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if server logout fails, local state is cleared, so user is effectively logged out
      toast.success('Logged out successfully');
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
