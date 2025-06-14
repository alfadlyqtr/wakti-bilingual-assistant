import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { useNavigate } from 'react-router-dom';
import { UserAttributes } from '@supabase/supabase-js';
import { useProgressierSync } from '@/hooks/useProgressierSync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  updateProfile: (data: { user_metadata: { display_name?: string; avatar_url?: string; full_name?: string; } }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper: fetch user profile by email
async function fetchProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToastHelper();
  const navigate = useNavigate();

  // New refs for debouncing enforcement and tracking DB updates
  const isSavingSessionRef = useRef(false);
  const lastSessionTokenRef = useRef<string | null>(null);

  // Minor utility to get/save our device's "session token" key (unique per login)
  function getCurrentSessionToken() {
    // Try to re-use the token if in memory/localStorage, else grab from Supabase session
    // If not available, we fallback to current supabase.auth.session() access_token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('wakti_session_token');
      if (token) return token;
    }
    return null;
  }

  function setCurrentSessionToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wakti_session_token', token);
    }
  }

  function clearCurrentSessionToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wakti_session_token');
    }
  }

  // ON/OFF Single-session: Clean up existing session logic and use only is_logged_in flag

  async function setProfileOnlineStatus(userId: string, isOnline: boolean) {
    try {
      if (!userId) return;
      await supabase
        .from('profiles')
        .update({ is_logged_in: isOnline })
        .eq('id', userId);
      console.log(`[AuthContext] Set is_logged_in for user ${userId} to ${isOnline}`);
    } catch (err) {
      console.error('[AuthContext] Failed to update is_logged_in:', err);
    }
  }

  useEffect(() => {
    // Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // --- Begin session flag logic ---
        if (newSession?.user) {
          // If user just logged in or session was restored, mark as online
          setProfileOnlineStatus(newSession.user.id, true);
          // Extra debug
          console.log('[AuthContext] AuthStateChange fired: ONLINE event, user:', newSession.user.id, 'event:', event);
        } else {
          // If session destroyed or logged out, mark as offline
          if (user?.id) {
            setProfileOnlineStatus(user.id, false);
            console.log('[AuthContext] AuthStateChange fired: OFFLINE event, user:', user.id, 'event:', event);
          }
        }
      }
    );
    // Initial session check, also mark online if restoring a session
    const getSession = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        // Patch: Set profile online if session exists
        if (session?.user) {
          setProfileOnlineStatus(session.user.id, true);
          console.log('[AuthContext] Initial session restore: Marked online:', session.user.id);
        }
      } catch (error) {
        console.error("Error getting session:", error);
        showError("Failed to retrieve session. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    getSession();
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Updated simple single-session sign-in
  const signIn = async (email: string) => {
    try {
      setLoading(true);

      // 1. Check if user is already logged in
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        showError("Your account is already signed in on another device. Please log out first.");
        setLoading(false);
        return;
      }

      // 2. Sign in with OTP magic link (or change to signInWithPassword if desired)
      const { error, data } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;

      // 3. Set is_logged_in to true if there's a current user (magic link sign-in is async)
      // For password-based sign-in, do:
      // if (data?.user) { await supabase.from('profiles').update({ is_logged_in: true }).eq('id', data.user.id); }

      showSuccess("Check your email - we've sent you a magic link to sign in.");
    } catch (error: any) {
      console.error("Error signing in:", error);
      showError(error.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Add signInWithPassword for apps that use password login
  const signInWithPassword = async (email: string, password: string) => {
    try {
      setLoading(true);

      // Check ON/OFF flag
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        showError("Your account is already signed in on another device. Please log out first.");
        setLoading(false);
        return;
      }

      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Set is_logged_in ON for user
      if (data?.user) {
        await supabase.from('profiles').update({ is_logged_in: true }).eq('id', data.user.id);
      }

      showSuccess("Sign in successful.");
      setUser(data.user);
      setSession(data.session ?? null);
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Error signing in (pw):", error);
      showError(error.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  // On sign up, set is_logged_in to true if user session exists
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });
      if (error) throw error;
      if (data?.session && data.user) {
        await supabase.from('profiles').update({ is_logged_in: true }).eq('id', data.user.id);
      }
      showSuccess("Check your email - we've sent you a confirmation link to verify your email.");
      setUser(data.user);
    } catch (error: any) {
      console.error("Error signing up:", error);
      showError(error.message || "Failed to sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // On sign out, clear ON/OFF flag for current user
  const signOut = async () => {
    try {
      setLoading(true);
      if (user) {
        await supabase.from('profiles').update({ is_logged_in: false }).eq('id', user.id);
        console.log('[AuthContext] signOut(): Marked user offline:', user.id);
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      navigate('/');
    } catch (error: any) {
      console.error("Error signing out:", error);
      showError(error.message || "Failed to sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      showSuccess("Check your email - we've sent you a link to reset your password.");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      showError(error.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    return resetPassword(email);
  };

  const updatePassword = async (newPassword: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showSuccess("Your password has been updated successfully.");
    } catch (error: any) {
      console.error("Error updating password:", error);
      showError(error.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateEmail = async (newEmail: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showSuccess("Your email has been updated successfully.");
    } catch (error: any) {
      console.error("Error updating email:", error);
      showError(error.message || "Failed to update email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: { user_metadata: { display_name?: string; avatar_url?: string; full_name?: string; } }) => {
    try {
      setLoading(true);
      // Convert to the format expected by Supabase
      const userData: UserAttributes = {
        data: data.user_metadata
      };
      const { error } = await supabase.auth.updateUser(userData);
      if (error) throw error;
      showSuccess("Your profile has been updated successfully.");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showError(error.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error: any) {
      console.error("Error refreshing session:", error);
    }
  };

  const deleteAccount = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        showError("No active session found.");
        return;
      }

      // Call our serverless function to delete the user account
      const SUPABASE_URL = "https://hxauxozopvpzpdygoqwf.supabase.co";
      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || "Failed to delete account.");
        return;
      }

      // Sign out the user locally after successful deletion
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      navigate('/');
      showSuccess("Your account has been successfully deleted.");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      showError(error.message || "Failed to delete account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update the AuthProvider to include Progressier sync
  const contextValue = {
    user,
    session,
    loading,
    isLoading: loading,
    signIn,
    signInWithPassword, // added for completeness with new ON/OFF logic
    signOut,
    signUp,
    resetPassword,
    forgotPassword,
    updatePassword,
    updateEmail,
    updateProfile,
    deleteAccount,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {/* Add Progressier sync component */}
      <ProgressierSync />
    </AuthContext.Provider>
  );
}

// Add ProgressierSync component at the end of the file
function ProgressierSync() {
  const { user } = useAuth();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Only render on client side and when user is authenticated
  if (!mounted || !user) return null;

  return <ProgressierSyncComponent />;
}

function ProgressierSyncComponent() {
  const { isSync, syncError, retrySync } = useProgressierSync();

  // Show error toast if sync fails
  React.useEffect(() => {
    if (syncError) {
      console.error('Progressier sync error:', syncError);
      // Don't show error toast to user as this is not critical for app functionality
    }
  }, [syncError]);

  // Show success message when sync completes (optional, can be removed)
  React.useEffect(() => {
    if (isSync) {
      console.log('Progressier sync completed successfully');
    }
  }, [isSync]);

  return null; // This component doesn't render anything visible
}
