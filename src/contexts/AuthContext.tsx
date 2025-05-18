import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { debugAuthState, forceSessionRefresh } from '@/utils/authHelpers';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authInitialized: boolean;
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
  isLoading: true,
  authInitialized: false,
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
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Debug helper with timestamp
  const logAuthState = (message: string, details?: any) => {
    console.log(`[${getTimestamp()}] AuthContext: ${message}`, {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!session,
      isLoading,
      authInitialized,
      ...(details || {})
    });
  };

  useEffect(() => {
    logAuthState('Setting up authentication');
    
    // Critical synchronization flag
    let isMounted = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuthState(`Auth state change: ${event}`, { 
          hasNewSession: !!currentSession,
          hasNewUser: !!currentSession?.user,
          sessionExpiresAt: currentSession?.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
        });
        
        // Safe updates - only if component is still mounted
        if (!isMounted) {
          logAuthState('Auth state change received but component unmounted, ignoring');
          return;
        }

        // Update state based on auth events
        if (event === 'SIGNED_OUT') {
          logAuthState('User signed out, clearing auth state');
          setUser(null);
          setSession(null);
          setIsLoading(false);
          setAuthInitialized(true);
        } else if (currentSession) {
          logAuthState('Updating auth state with new session', {
            userId: currentSession.user?.id,
            sessionExpiresAt: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
          });
          setUser(currentSession.user);
          setSession(currentSession);
          setIsLoading(false);
          setAuthInitialized(true);
        } else {
          // Ensure we're not stuck loading
          setAuthInitialized(true);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      try {
        logAuthState('Checking for existing session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        // Safe updates - only if component is still mounted
        if (!isMounted) {
          logAuthState('Got session data but component unmounted, ignoring');
          return;
        }
        
        if (currentSession) {
          logAuthState('Found existing session', { 
            userId: currentSession.user?.id,
            expiry: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : null
          });
          
          setUser(currentSession.user);
          setSession(currentSession);
        } else {
          logAuthState('No existing session found');
        }
        
        // Always mark as initialized after checking
        setIsLoading(false);
        setAuthInitialized(true);
        
        // For debugging
        debugAuthState();
      } catch (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error initializing auth:`, error);
        if (isMounted) {
          setIsLoading(false);
          setAuthInitialized(true); // Mark as initialized even on error
        }
      }
    };

    // Initialize auth
    initializeAuth();

    return () => {
      logAuthState('Cleaning up auth subscription');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    logAuthState('Manually refreshing session');
    try {
      const { data, error } = await forceSessionRefresh();
      
      if (error) {
        logAuthState('Error refreshing session', { error });
        return null;
      }
      
      if (data.session) {
        logAuthState('Session refresh successful', {
          userId: data.session.user?.id,
          sessionExpiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
        });
        setSession(data.session);
        setUser(data.session.user);
      } else {
        logAuthState('Session refresh returned no session');
      }
      
      return data.session;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Error refreshing session:`, error);
      return null;
    }
  };

  const signIn = async (email: string, password: string) => {
    logAuthState('Attempting sign in', { email });
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        logAuthState('Error signing in:', { error });
        setIsLoading(false);
      }
      
      return error;
    } catch (error) {
      logAuthState('Exception during sign in:', { error });
      setIsLoading(false);
      return error as AuthError;
    }
  };

  const signUp = async (email: string, password: string) => {
    logAuthState('Attempting sign up', { email });
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        console.error(`[${getTimestamp()}] AuthContext: Error signing up:`, error);
        setIsLoading(false);
      } else {
        logAuthState("Sign up successful");
        // We'll let onAuthStateChange handle setting isLoading to false
      }
      
      return error;
    } catch (error) {
      console.error(`[${getTimestamp()}] AuthContext: Exception during sign up:`, error);
      setIsLoading(false);
      return error as AuthError;
    }
  };

  const signOut = async () => {
    logAuthState('Attempting sign out');
    try {
      // Set loading state to indicate logout in progress
      setIsLoading(true);
      
      // Clear auth state first for better UX
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logAuthState('Error signing out:', { error });
        setIsLoading(false);
        throw error;
      }
      
      logAuthState('Sign out successful');
      // Complete loading state now that we're done
      setIsLoading(false);
    } catch (error) {
      logAuthState('Exception during sign out:', { error });
      setIsLoading(false);
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
    isLoading,
    authInitialized,
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
