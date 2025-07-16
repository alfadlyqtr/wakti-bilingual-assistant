import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { WN } from '@/services/WN';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: { username?: string; full_name?: string; avatar_url?: string; }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setSession(session ?? null);
      setIsLoading(false);
    };

    getInitialSession();

    // set auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🚀 Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setSession(session);
        setIsLoading(false);
        
        console.log('🚀 Auth state changed - starting WN');
        // Start unified WN system
        WN.start(session.user.id);
        
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setIsLoading(false);
        
        console.log('🛑 Auth state changed - stopping WN');
        // Stop unified WN system
        WN.stop();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      WN.stop();
    };
  }, []);

  useEffect(() => {
    const getProfile = async () => {
      if (!user?.id) {
        setProfile(null);
        return;
      }

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
        }

        setProfile(profileData || null);
      } catch (error) {
        console.error('Unexpected error fetching profile:', error);
      }
    };

    getProfile();
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: { username?: string; full_name?: string; avatar_url?: string; }) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user?.id,
        ...updates,
        updated_at: new Date(),
      });

      if (error) {
        throw error;
      }

      // Optimistically update the profile in the context
      setProfile(prevProfile => ({ ...prevProfile, ...updates } as Profile));

      // Dispatch a custom event to signal avatar update
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar_url: updates.avatar_url } }));

    } catch (error: any) {
      console.error("Error updating the profile:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
