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
  const authStateUpdateInProgress = useRef(false);
  
  // Debug helper to track auth state changes
  const logAuthState = (message: string, details?: any) => {
    console.log(`AuthContext: ${message}`, {
      hasUser: !!user,
      hasSession: !!session,
      isLoading: loading,
      currentPath: location.pathname,
      ...(details || {})
    });
  };

  useEffect(() => {
    logAuthState('Setting up authentication listeners');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuthState(`Auth state change event: ${event}`, { hasNewSession: !!currentSession });
        
        // Prevent multiple state updates from happening simultaneously
        if (authStateUpdateInProgress.current) {
          logAuthState('Auth state update already in progress, waiting');
          return;
        }
        
        authStateUpdateInProgress.current = true;
        
        // Properly handle sign out event
        if (event === 'SIGNED_OUT') {
          logAuthState('User signed out, clearing state');
          
          // Clear auth state
          setUser(null);
          setSession(null);
          
          // Only navigate if not already navigating
          if (!navigationInProgress.current && location.pathname !== '/home' && location.pathname !== '/login') {
            logAuthState('Navigating to home after sign out');
            navigationInProgress.current = true;
            
            // Add a small delay to ensure state updates have propagated
            setTimeout(() => {
              navigate('/home', { replace: true });
              // Reset navigation flag after a small delay
              setTimeout(() => {
                navigationInProgress.current = false;
              }, 100);
            }, 50);
          }
        } else {
          // For other events, update the session and user state
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
        
        // Mark loading as complete
        setLoading(false);
        
        // Reset auth state update flag after a small delay
        setTimeout(() => {
          authStateUpdateInProgress.current = false;
        }, 100);
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
  }, []); // Removed location.pathname from dependencies to prevent reinitializing auth on route changes

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
    logAuthState('Attempting sign out');
    
    // If navigation already in progress, prevent duplicate sign out
    if (navigationInProgress.current) {
      logAuthState('Navigation already in progress, skipping sign out');
      return;
    }
    
    navigationInProgress.current = true;
    
    try {
      // Clear auth state first
      setUser(null);
      setSession(null);
      
      // Perform the actual sign out
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      logAuthState('Sign out successful');
      
      // Note: No need to navigate here, the onAuthStateChange handler will handle this
    } catch (error) {
      console.error("AuthProvider: Error signing out:", error);
      // Reset navigation flag on error
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
