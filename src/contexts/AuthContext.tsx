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

export const AuthProvider = ({ children, requireAuth = false }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  // Debug helper
  const logAuthState = (message: string, details?: any) => {
    console.log(`AuthContext: ${message}`, {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!session,
      isLoading: loading,
      initComplete: initializationComplete,
      ...(details || {})
    });
  };

  useEffect(() => {
    logAuthState('Setting up authentication');
    
    // Set up auth state listener first to ensure we don't miss any events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuthState(`Auth state change: ${event}`, { 
          hasNewSession: !!currentSession,
          hasNewUser: !!currentSession?.user
        });
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          logAuthState('User signed out, clearing state');
          // Immediately clear user state to prevent flashes of content
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        
        // Handle sign in and token refresh events
        if (currentSession) {
          logAuthState('Session updated', { 
            userId: currentSession.user?.id, 
            event,
            expiry: new Date(currentSession.expires_at! * 1000)
          });
          
          setSession(currentSession);
          setUser(currentSession.user ?? null);
          setLoading(false);
          return;
        }
        
        // For other events without a session, ensure loading state is updated
        if (['SIGNED_OUT', 'USER_UPDATED'].includes(event)) {
          setLoading(false);
        }
      }
    );

    // Then check for existing session, with a small delay to ensure listener is set up
    const initializeAuth = async () => {
      try {
        // Small delay to ensure listener is registered first
        await new Promise(resolve => setTimeout(resolve, 50));
        
        logAuthState('Checking for existing session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          logAuthState('Found existing session', { 
            userId: currentSession.user?.id,
            expiry: new Date(currentSession.expires_at! * 1000)  
          });
          
          setSession(currentSession);
          setUser(currentSession.user ?? null);
        } else {
          logAuthState('No existing session found');
        }
        
        // Set loading to false AND mark initialization as complete
        setLoading(false);
        setInitializationComplete(true);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
        setInitializationComplete(true); // Still mark as complete even on error
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    logAuthState('Manually refreshing session');
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      logAuthState('Refresh session result', { 
        hasSession: !!currentSession,
        userId: currentSession?.user?.id,
        expiry: currentSession ? new Date(currentSession.expires_at! * 1000) : null
      });
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
      
      return currentSession;
    } catch (error) {
      console.error("Error refreshing session:", error);
      return null;
    }
  };

  const signIn = async (email: string, password: string) => {
    logAuthState('Attempting sign in', { email });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error("Error signing in:", error);
      } else {
        logAuthState("Sign in successful");
        // Session will be updated via the onAuthStateChange listener
        
        // If session doesn't update via listener within 1 second, try refresh
        setTimeout(async () => {
          if (!session) {
            logAuthState("Session not updated via listener, attempting manual refresh");
            await refreshSession();
          }
        }, 1000);
      }
      
      return error;
    } catch (error) {
      console.error("Exception during sign in:", error);
      return error as AuthError;
    }
  };

  const signUp = async (email: string, password: string) => {
    logAuthState('Attempting sign up', { email });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        console.error("Error signing up:", error);
      } else {
        logAuthState("Sign up successful");
      }
      
      return error;
    } catch (error) {
      console.error("Exception during sign up:", error);
      return error as AuthError;
    }
  };

  const signOut = async () => {
    logAuthState('Attempting sign out');
    try {
      // Clear auth state first to avoid flash of protected content
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
        throw error;
      }
      
      logAuthState('Sign out successful');
    } catch (error) {
      console.error("Exception during sign out:", error);
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      return error;
    } catch (error) {
      console.error("Error resetting password:", error);
      return error as AuthError;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return error;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return error as AuthError;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const { data: userData, error } = await supabase.auth.updateUser(data);
      if (error) {
        console.error("Error updating profile:", error);
        return null;
      }
      
      // Refresh the session after profile update
      await refreshSession();
      
      return userData.user;
    } catch (error) {
      console.error("Error updating profile:", error);
      return null;
    }
  };

  const updateEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email });
      
      // Refresh the session after email update
      if (!error) {
        await refreshSession();
      }
      
      return error;
    } catch (error) {
      console.error("Error updating email:", error);
      return error as AuthError;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return error;
    } catch (error) {
      console.error("Error updating password:", error);
      return error as AuthError;
    }
  };

  const value = {
    user,
    session,
    loading,
    isLoading: loading || !initializationComplete,  // Account for initialization state
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
