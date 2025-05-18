
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Define the AuthContext value interface
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// Create the AuthContext
const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ user: null, error: null }),
  logout: async () => {},
  refreshSession: async () => {}
});

// Custom hook to use the AuthContext
export const useAuth = () => useContext(AuthContext);

// AuthProvider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Calculate isAuthenticated based on session existence
  const isAuthenticated = !!session;

  // Login function
  const login = async (email: string, password: string) => {
    console.log(`[${new Date().toISOString()}] AuthContext: Attempting login for ${email}`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] AuthContext: Login error`, error);
        return { user: null, error };
      }
      
      console.log(`[${new Date().toISOString()}] AuthContext: Login successful`, data.user?.id);
      return { user: data.user, error: null };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AuthContext: Unexpected login error`, error);
      return { user: null, error: error as AuthError };
    }
  };

  // Logout function
  const logout = async () => {
    console.log(`[${new Date().toISOString()}] AuthContext: Attempting logout`);
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error(`[${new Date().toISOString()}] AuthContext: Logout error`, error);
        toast({
          title: "Logout Failed",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      
      // Clear auth state immediately to avoid stale state
      setUser(null);
      setSession(null);
      
      console.log(`[${new Date().toISOString()}] AuthContext: Logout successful`);
      toast({
        title: "Logout Successful",
        description: "You have been logged out successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AuthContext: Unexpected logout error`, error);
      toast({
        title: "Logout Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  // Refresh session function
  const refreshSession = async () => {
    console.log(`[${new Date().toISOString()}] AuthContext: Refreshing session`);
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error(`[${new Date().toISOString()}] AuthContext: Session refresh error`, error);
        return;
      }
      
      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        console.log(`[${new Date().toISOString()}] AuthContext: Session refreshed successfully`, data.session.user?.id);
      } else {
        setSession(null);
        setUser(null);
        console.log(`[${new Date().toISOString()}] AuthContext: No active session found during refresh`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AuthContext: Unexpected session refresh error`, error);
    }
  };

  // Initialize auth state on component mount
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] AuthContext: Initializing auth state`);
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`[${new Date().toISOString()}] AuthContext: Auth state changed - Event: ${event}`);
        
        // Update session and user state
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Log auth state changes
        if (event === 'SIGNED_IN') {
          console.log(`[${new Date().toISOString()}] AuthContext: User signed in`, currentSession?.user?.id);
        } else if (event === 'SIGNED_OUT') {
          console.log(`[${new Date().toISOString()}] AuthContext: User signed out`);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log(`[${new Date().toISOString()}] AuthContext: Token refreshed`, currentSession?.user?.id);
        } else if (event === 'USER_UPDATED') {
          console.log(`[${new Date().toISOString()}] AuthContext: User updated`, currentSession?.user?.id);
        }
      }
    );
    
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log(`[${new Date().toISOString()}] AuthContext: Initial session check`, 
        currentSession ? `User ID: ${currentSession.user.id}` : 'No active session');
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    }).catch(error => {
      console.error(`[${new Date().toISOString()}] AuthContext: Error getting initial session`, error);
      setIsLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => {
      console.log(`[${new Date().toISOString()}] AuthContext: Cleaning up auth subscriptions`);
      subscription.unsubscribe();
    };
  }, []);

  // Log whenever auth state changes
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] AuthContext: Auth state updated - isAuthenticated: ${isAuthenticated}`);
  }, [isAuthenticated]);

  // Create the context value object
  const contextValue: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshSession
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
