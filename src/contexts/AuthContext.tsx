
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

// Define the proper AuthContext type to match what components expect
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authInitialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any } | null>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any } | null>;
  signOut: () => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<{ error: any } | null>;
  forgotPassword: (email: string) => Promise<{ error: any } | null>;
}

// Create the context with a proper default state
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  authInitialized: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  forgotPassword: async () => ({ error: null })
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  console.log("[AUTH] Provider initializing");

  // Initialize auth state
  useEffect(() => {
    console.log("[AUTH] Setting up auth listener");
    
    // First set up the auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`[AUTH] Auth state changed: ${event}`, newSession?.user?.email);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (!authInitialized) setAuthInitialized(true);
        if (isLoading) setIsLoading(false);
      }
    );

    // Then get the current session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log("[AUTH] Initial session check:", currentSession?.user?.email);
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
      setAuthInitialized(true);
    });

    // Clean up subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  // Authentication functions
  const signIn = async (email: string, password: string) => {
    console.log(`[AUTH] Signing in: ${email}`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error("[AUTH] Sign in error:", error);
        return { error };
      }
      
      console.log("[AUTH] Sign in successful:", data.user?.email);
      return null;
    } catch (error) {
      console.error("[AUTH] Sign in exception:", error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    console.log(`[AUTH] Signing up: ${email}`);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData || {}
        }
      });
      
      if (error) {
        console.error("[AUTH] Sign up error:", error);
        return { error };
      }
      
      console.log("[AUTH] Sign up successful:", data.user?.email);
      return null;
    } catch (error) {
      console.error("[AUTH] Sign up exception:", error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log("[AUTH] Signing out");
    try {
      await supabase.auth.signOut();
      console.log("[AUTH] Sign out successful");
    } catch (error) {
      console.error("[AUTH] Sign out error:", error);
    }
  };

  const resetPassword = async (token: string, password: string) => {
    console.log("[AUTH] Resetting password");
    try {
      const { error } = await supabase.auth.updateUser({
        password
      });
      
      if (error) {
        console.error("[AUTH] Reset password error:", error);
        return { error };
      }
      
      console.log("[AUTH] Password reset successful");
      return null;
    } catch (error) {
      console.error("[AUTH] Reset password exception:", error);
      return { error };
    }
  };

  const forgotPassword = async (email: string) => {
    console.log(`[AUTH] Requesting password reset for: ${email}`);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password"
      });
      
      if (error) {
        console.error("[AUTH] Forgot password error:", error);
        return { error };
      }
      
      console.log("[AUTH] Password reset email sent");
      return null;
    } catch (error) {
      console.error("[AUTH] Forgot password exception:", error);
      return { error };
    }
  };

  // Value object for the provider
  const value = {
    user,
    session,
    isLoading,
    authInitialized,
    signIn,
    signUp,
    signOut,
    resetPassword,
    forgotPassword
  };

  console.log("[AUTH] Provider state:", { 
    isAuthenticated: !!user,
    isLoading,
    authInitialized
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
