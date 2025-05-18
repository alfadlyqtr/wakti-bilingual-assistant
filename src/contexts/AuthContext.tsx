
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authInitialized: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
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
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Set up auth state listener and check for existing session
  useEffect(() => {
    console.log("AuthProvider: Setting up auth listeners");
    
    // Flag to avoid state updates after component unmount
    let isMounted = true;
    
    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`AuthProvider: Auth state changed - ${event}`);
        
        if (!isMounted) return;
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        } else if (currentSession) {
          setUser(currentSession.user);
          setSession(currentSession);
        }
        
        setIsLoading(false);
        setAuthInitialized(true);
      }
    );
    
    // Check for existing session
    const initializeAuth = async () => {
      try {
        console.log("AuthProvider: Checking for existing session");
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (currentSession) {
          console.log("AuthProvider: Found existing session");
          setUser(currentSession.user);
          setSession(currentSession);
        } else {
          console.log("AuthProvider: No existing session found");
        }
        
        setIsLoading(false);
        setAuthInitialized(true);
      } catch (error) {
        console.error("AuthProvider: Error initializing auth", error);
        
        if (isMounted) {
          setIsLoading(false);
          setAuthInitialized(true);
        }
      }
    };
    
    initializeAuth();
    
    // Clean up subscription on unmount
    return () => {
      console.log("AuthProvider: Cleaning up auth subscription");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      console.log("AuthProvider: Attempting sign in");
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error("AuthProvider: Sign in error", error);
        return error;
      }
      
      console.log("AuthProvider: Sign in successful");
      return null;
    } catch (error) {
      console.error("AuthProvider: Sign in exception", error);
      return error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign up function
  const signUp = async (email: string, password: string) => {
    try {
      console.log("AuthProvider: Attempting sign up");
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        console.error("AuthProvider: Sign up error", error);
        return error;
      }
      
      console.log("AuthProvider: Sign up successful");
      return null;
    } catch (error) {
      console.error("AuthProvider: Sign up exception", error);
      return error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign out function
  const signOut = async () => {
    try {
      console.log("AuthProvider: Attempting sign out");
      setIsLoading(true);
      
      // Clear auth state first for better UX
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("AuthProvider: Sign out error", error);
        throw error;
      }
      
      console.log("AuthProvider: Sign out successful");
    } catch (error) {
      console.error("AuthProvider: Sign out exception", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset password function
  const resetPassword = async (token: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      return error;
    } catch (error) {
      return error;
    }
  };
  
  // Forgot password function
  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return error;
    } catch (error) {
      return error;
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
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
