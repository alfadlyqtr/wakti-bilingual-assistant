import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    console.log('AuthProvider: Setting up authentication listeners');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('AuthProvider: Auth state change event:', event);
        console.log('AuthProvider: Session exists:', !!currentSession);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Only redirect on signout if explicitly required
        if (event === 'SIGNED_OUT' && requireAuth) {
          console.log('AuthProvider: User signed out, redirecting to login');
          // Use a timeout to avoid potential race conditions
          setTimeout(() => {
            navigate('/login');
          }, 0);
        }
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        console.log('AuthProvider: Checking for existing session');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('AuthProvider: Initial session exists:', !!currentSession);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        setInitialized(true);
        
        // Only redirect if authentication is required but user is not logged in
        if (requireAuth && !currentSession) {
          console.log('AuthProvider: No session found, redirecting to login');
          navigate('/login');
        }
      } catch (error) {
        console.error('AuthProvider: Error initializing auth', error);
        setLoading(false);
        setInitialized(true);
        if (requireAuth) {
          navigate('/login');
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, [navigate, requireAuth]);

  const signIn = async (email: string, password: string) => {
    console.log('AuthProvider: Attempting sign in for email:', email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("AuthProvider: Error signing in:", error);
      } else {
        console.log("AuthProvider: Sign in successful");
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
    try {
      await supabase.auth.signOut();
      console.log('AuthProvider: Sign out successful');
      navigate('/login');
    } catch (error) {
      console.error("AuthProvider: Error signing out:", error);
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
      return userData.user;
    } catch (error) {
      console.error("Error updating profile:", error);
      return null;
    }
  };

  const updateEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email });
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
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider requireAuth={true}>{children}</AuthProvider>;
};
