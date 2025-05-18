
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const isAuthenticated = !!session;

  // Simple login function with direct navigation
  const login = async (email: string, password: string) => {
    console.log(`[${new Date().toISOString()}] AuthContext: Login attempt for ${email}`);
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] AuthContext: Login error`, error);
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      console.log(`[${new Date().toISOString()}] AuthContext: Login successful`, data.user?.id);
      setUser(data.user);
      setSession(data.session);
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      
      // Immediately navigate to dashboard on successful login
      console.log(`[${new Date().toISOString()}] AuthContext: Redirecting to dashboard`);
      navigate('/dashboard');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AuthContext: Unexpected login error`, error);
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Simple logout function with direct navigation
  const logout = async () => {
    console.log(`[${new Date().toISOString()}] AuthContext: Logout initiated`);
    
    try {
      // First clear the auth state
      setUser(null);
      setSession(null);
      
      // Then call the API
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
      
      console.log(`[${new Date().toISOString()}] AuthContext: Logout successful`);
      toast({
        title: "Logout Successful",
        description: "You have been logged out successfully.",
      });
      
      // Immediately navigate to login page
      console.log(`[${new Date().toISOString()}] AuthContext: Redirecting to login page`);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] AuthContext: Unexpected logout error`, error);
      toast({
        title: "Logout Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  // Initialize auth state on component mount
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] AuthContext: Initializing auth state`);
    let mounted = true;
    
    async function getInitialSession() {
      try {
        const { data } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] AuthContext: Error getting initial session`, error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    getInitialSession();
    
    // Set up the auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (mounted) {
        console.log(`[${new Date().toISOString()}] AuthContext: Auth state changed - Event: ${event}`);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    });
    
    return () => {
      console.log(`[${new Date().toISOString()}] AuthContext: Cleaning up auth subscriptions`);
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const contextValue: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
