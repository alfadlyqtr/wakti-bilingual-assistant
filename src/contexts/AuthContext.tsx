import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

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
  refreshSession: () => Promise<void>;
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
  refreshSession: async () => {},
});

interface AuthProviderProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const AuthProvider = ({ children, requireAuth = false }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationInProgress = useRef(false);
  const lastAuthEvent = useRef<string | null>(null);
  
  // Debug helper to track auth state changes
  const logAuthState = (message: string, details?: any) => {
    console.log(`AuthContext: ${message}`, {
      hasUser: !!user,
      hasSession: !!session,
      isLoading: loading,
      currentPath: location.pathname,
      lastAuthEvent: lastAuthEvent.current,
      ...(details || {})
    });
  };

  useEffect(() => {
    logAuthState('Setting up authentication listeners');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        lastAuthEvent.current = event;
        logAuthState(`Auth state change event: ${event}`, { hasNewSession: !!currentSession });
        
        // Properly handle sign out event
        if (event === 'SIGNED_OUT') {
          logAuthState('User signed out, clearing state and redirecting to home');
          // We need to clear all states
          setUser(null);
          setSession(null);
          
          // Use a timeout to avoid race conditions and ensure state is cleared before redirect
          setTimeout(() => {
            if (!navigationInProgress.current) {
              navigationInProgress.current = true;
              navigate('/home', { replace: true });
              setTimeout(() => {
                navigationInProgress.current = false;
              }, 500);
            }
          }, 100);
        } else {
          // For other events, update the session and user state
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        logAuthState('Checking for existing session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        logAuthState('Initial session check complete', { hasSession: !!currentSession });
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        setInitialized(true);
      } catch (error) {
        console.error('AuthProvider: Error initializing auth', error);
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      logAuthState('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  // Add a function to refresh the session
  const refreshSession = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
    }
  };

  const signIn = async (email: string, password: string) => {
    logAuthState('Attempting sign in for email:', { email });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("AuthProvider: Error signing in:", error);
      } else {
        logAuthState("Sign in successful");
      }
      return error;
    } catch (error) {
      console.error("AuthProvider: Exception during sign in:", error);
      return error as AuthError;
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthProvider: Attempting sign up for email:', email);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        console.error("AuthProvider: Error signing up:", error);
      } else {
        console.log("AuthProvider: Sign up successful");
      }
      return error;
    } catch (error) {
      console.error("AuthProvider: Exception during sign up:", error);
      return error as AuthError;
    }
  };

  const signOut = async () => {
    console.log('AuthProvider: Attempting sign out');
    
    // Set a flag to prevent multiple navigation attempts
    if (navigationInProgress.current) {
      console.log('AuthProvider: Navigation already in progress, skipping');
      return;
    }
    
    try {
      // First, clear the state to prevent flashing of protected content
      setUser(null);
      setSession(null);
      
      // Then perform the actual sign out
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthProvider: Error signing out:', error);
        throw error;
      }
      
      console.log('AuthProvider: Sign out successful, redirecting to home');
      
      // Use timeout to ensure state updates have propagated
      navigationInProgress.current = true;
      setTimeout(() => {
        navigate('/home', { replace: true });
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 500);
      }, 100);
      
    } catch (error) {
      console.error("AuthProvider: Error signing out:", error);
      navigationInProgress.current = false;
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
    isLoading: loading,
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
