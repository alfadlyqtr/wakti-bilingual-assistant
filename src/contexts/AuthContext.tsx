
import { createContext, useContext, useState, useEffect } from 'react';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  updateProfile: (updates: any) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔐 AuthContext: Initializing authentication...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setSession(session);
            setIsAuthenticated(true);
            console.log('✅ AuthContext: User authenticated:', session.user.id);
            
            // Initialize WN1 notification service
            const { wn1NotificationService } = await import('@/services/wn1NotificationService');
            await wn1NotificationService.initialize(session.user.id);
            console.log('✅ AuthContext: WN1 notification service initialized');
          } else {
            setUser(null);
            setSession(null);
            setIsAuthenticated(false);
            console.log('❌ AuthContext: No active session');
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ AuthContext: Auth initialization failed:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 AuthContext: Auth state changed:', event);
        
        if (session?.user) {
          setUser(session.user);
          setSession(session);
          setIsAuthenticated(true);
          
          // Initialize WN1 for new session
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const { wn1NotificationService } = await import('@/services/wn1NotificationService');
            await wn1NotificationService.initialize(session.user.id);
            console.log('✅ AuthContext: WN1 initialized for session');
          }
        } else {
          setUser(null);
          setSession(null);
          setIsAuthenticated(false);
          
          // Cleanup WN1 on logout
          if (event === 'SIGNED_OUT') {
            const { wn1NotificationService } = await import('@/services/wn1NotificationService');
            wn1NotificationService.cleanup();
            console.log('🧹 AuthContext: WN1 cleaned up');
          }
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const updateProfile = async (updates: any) => {
    try {
      if (!user) throw new Error('No user logged in');
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const updateEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    } catch (error) {
      console.error('Error updating email:', error);
      throw error;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error sending forgot password email:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAuthenticated(false);
      console.log('🚪 User signed out');
    } catch (error) {
      console.error('❌ Error signing out:', error);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    loading: isLoading,
    updateProfile,
    updateEmail,
    updatePassword,
    forgotPassword,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}
