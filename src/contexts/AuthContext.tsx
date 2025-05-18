
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthError | null>;
  forgotPassword: (email: string) => Promise<AuthError | null>;
  updateProfile: (data: Partial<User>) => Promise<User | null>;
  updateEmail: (email: string) => Promise<AuthError | null>;
  updatePassword: (password: string) => Promise<AuthError | null>;
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isLoading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  resetPassword: async () => null,
  forgotPassword: async () => null,
  updateProfile: async () => null,
  updateEmail: async () => null,
  updatePassword: async () => null,
  refreshSession: async () => null,
});

interface AuthProviderProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

// Helper function to get current timestamp for logging
const getTimestamp = () => new Date().toISOString();

export const AuthProvider = ({ children, requireAuth = false }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Debug helper with timestamp
  const logAuthState = (message: string, details?: any) => {
    console.log(`[${getTimestamp()}] AuthContext: ${message}`, {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!session,
      isLoading: loading,
      ...(details || {})
    });
  };

  useEffect(() => {
    logAuthState('Setting up authentication');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuthState(`Auth state change: ${event}`, { 
          hasNewSession: !!currentSession,
          hasNewUser: !!currentSession?.user,
          sessionExpiresAt: currentSession?.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
        });
        
        // Update state based on auth events
        if (event === 'SIGNED_OUT') {
          logAuthState('User signed out, clearing auth state');
          setUser(null);
          setSession(null);
        } else if (currentSession) {
          logAuthState('Updating auth state with new session', {
            userId: currentSession.user?.id,
            sessionExpiresAt: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
          });
          setSession(currentSession);
          setUser(currentSession.user ?? null);
        }
        
        // Always ensure loading is false after auth state changes
        setLoading(false);
      }
    );

    // Check for existing session immediately
    const initializeAuth = async () => {
      try {
        logAuthState('Checking for existing session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          logAuthState('Found existing session', { 
            userId: currentSession.user?.id,
            expiry: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
          });
          
          setSession(currentSession);
          setUser(currentSession.user ?? null);
        } else {
          logAuthState('No existing session found');
        }
        
        // Always set loading to false after initialization
        setLoading(false);
      } catch (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error initializing auth:`, error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      logAuthState('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    logAuthState('Manually refreshing session');
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        logAuthState('Session refresh successful', {
          userId: currentSession.user?.id,
          sessionExpiresAt: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
        });
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        logAuthState('Session refresh returned no session');
      }
      
      return currentSession;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Error refreshing session:`, error);
      return null;
    }
  };

  const signIn = async (email: string, password: string) => {
    logAuthState('Attempting sign in', { email });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error signing in:`, error);
      } else {
        logAuthState("Sign in successful");
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during sign in:`, error);
      return error as AuthError;
    }
  };

  const signUp = async (email: string, password: string) => {
    logAuthState('Attempting sign up', { email });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error signing up:`, error);
      } else {
        logAuthState("Sign up successful");
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during sign up:`, error);
      return error as AuthError;
    }
  };

  const signOut = async () => {
    logAuthState('Attempting sign out');
    try {
      // Clear auth state first for better UX
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error signing out:`, error);
        throw error;
      }
      
      logAuthState('Sign out successful');
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during sign out:`, error);
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    logAuthState('Attempting password reset');
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error resetting password:`, error);
      } else {
        logAuthState('Password reset successful');
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during password reset:`, error);
      return error as AuthError;
    }
  };

  const forgotPassword = async (email: string) => {
    logAuthState('Attempting password recovery', { email });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error sending password reset email:`, error);
      } else {
        logAuthState('Password recovery email sent');
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during password recovery:`, error);
      return error as AuthError;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    logAuthState('Attempting profile update');
    try {
      const { data: userData, error } = await supabase.auth.updateUser(data);
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error updating profile:`, error);
        return null;
      }
      
      logAuthState('Profile update successful');
      
      // Refresh the session after profile update
      await refreshSession();
      
      return userData.user;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during profile update:`, error);
      return null;
    }
  };

  const updateEmail = async (email: string) => {
    logAuthState('Attempting email update', { newEmail: email });
    try {
      const { error } = await supabase.auth.updateUser({ email });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error updating email:`, error);
      } else {
        logAuthState('Email update successful');
        // Refresh the session after email update
        await refreshSession();
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during email update:`, error);
      return error as AuthError;
    }
  };

  const updatePassword = async (password: string) => {
    logAuthState('Attempting password update');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error updating password:`, error);
      } else {
        logAuthState('Password update successful');
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during password update:`, error);
      return error as AuthError;
    }
  };

  const value = {
    user,
    session,
    loading,
    isLoading: loading,  // Simplified loading state
    signIn,
    signUp,
    signOut,
    resetPassword,
    forgotPassword,
    updateProfile,
    updateEmail,
    updatePassword,
    refreshSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider requireAuth={true}>{children}</AuthProvider>;
};
