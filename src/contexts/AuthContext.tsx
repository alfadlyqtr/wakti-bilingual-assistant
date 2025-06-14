import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { useNavigate } from 'react-router-dom';
import { UserAttributes } from '@supabase/supabase-js';
import { useProgressierSync } from '@/hooks/useProgressierSync';
import { v4 as uuidv4 } from 'uuid';

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

  // Strict single-session helper state
  const [sessionMismatch, setSessionMismatch] = useState(false);

  // New refs for debouncing enforcement and tracking DB updates
  const isSavingSessionRef = useRef(false);
  const lastSessionTokenRef = useRef<string | null>(null);

  // SESSION TOKEN UTILS
  function getCurrentSessionToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wakti_session_token');
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

  // Set online, is_logged_in ON, AND store the unique session_token
  async function setProfileOnlineStatus(userId: string, isOnline: boolean, sessionToken: string | null = null) {
    try {
      if (!userId) return;
      const updateObj: any = { is_logged_in: isOnline };
      if (sessionToken !== undefined) updateObj.session_token = sessionToken;
      await supabase.from('profiles').update(updateObj).eq('id', userId);
      console.log(`[AuthContext] Set is_logged_in for user ${userId} to ${isOnline}, session_token:`, sessionToken);
    } catch (err) {
      console.error('[AuthContext] Failed to update is_logged_in/session_token:', err);
    }
  }

  // Checks current user's session_token and is_logged_in, triggers force-logout if mismatch
  async function validateCurrentSession(userObj: User) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_logged_in, session_token')
      .eq('id', userObj.id)
      .maybeSingle();

    const localToken = getCurrentSessionToken();

    if (error || !profile) {
      setSessionMismatch(true);
      showError("Failed to validate session.");
      await signOut({ preventProfileUpdate: true }); // fallback
      return false;
    }
    if (!profile.is_logged_in) {
      setSessionMismatch(true);
      showError("You have been logged out because your session is no longer active. Please log in again.");
      await signOut({ preventProfileUpdate: true });
      return false;
    }
    if (!profile.session_token || !localToken || profile.session_token !== localToken) {
      setSessionMismatch(true);
      showError("Your account is signed in on another device or browser. Please log in again.");
      await signOut({ preventProfileUpdate: true });
      return false;
    }
    return true;
  }

  useEffect(() => {
    // Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Always run validation (force logout if session_token mismatch)
          const valid = await validateCurrentSession(newSession.user);
          if (!valid) {
            setUser(null);
            setSession(null);
            return;
          }
          // User valid, nothing else needed because logins already set session_token/is_logged_in
        } else {
          // If fully logged out, always clear local session token
          clearCurrentSessionToken();
        }
      }
    );

    // Initial session check (restore)
    const getSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Validate session on restore
        const valid = await validateCurrentSession(session.user);
        if (!valid) {
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    };
    getSession();

    return () => {
      subscription.unsubscribe();
    };
    // intentionally leaving [] here, NOT [user], so this only runs on mount
    // (the session change logic is handled by the listener above)
    // eslint-disable-next-line
  }, []);

  // Updated simple single-session sign-in
  const signIn = async (email: string) => {
    try {
      setLoading(true);
      // 1. Check if user is already logged in somewhere else
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        showError("Your account is already signed in on another device. Please log out first.");
        setLoading(false);
        return;
      }
      // 2. Send magic link
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      showSuccess("Check your email - we've sent you a magic link to sign in.");
    } catch (error: any) {
      console.error("Error signing in:", error);
      showError(error.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password sign-in (enforced)
  const signInWithPassword = async (email: string, password: string) => {
    try {
      setLoading(true);
      // 1. Check if already signed in
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        showError("Your account is already signed in on another device. Please log out first.");
        setLoading(false);
        return;
      }
      // 2. Proceed
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // 3. Generate session token and save it locally & remotely
      if (data?.user && data.session) {
        const waktiSessionToken = uuidv4();
        setCurrentSessionToken(waktiSessionToken);
        await setProfileOnlineStatus(data.user.id, true, waktiSessionToken);
        setUser(data.user);
        setSession(data.session ?? null);
      }
      showSuccess("Sign in successful.");
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
      // Magic link confirmation will happen later (same logic on first login)
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
  const signOut = async (options?: { preventProfileUpdate?: boolean }) => {
    try {
      setLoading(true);
      if (user && !options?.preventProfileUpdate) {
        // Mark offline and clear session token in DB and local
        await supabase.from('profiles').update({ is_logged_in: false, session_token: null }).eq('id', user.id);
        clearCurrentSessionToken();
        console.log('[AuthContext] signOut(): Marked user offline and session_token cleared:', user.id);
      } else {
        clearCurrentSessionToken();
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setSessionMismatch(false);
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

  // Show blocked notice if session mismatch
  if (sessionMismatch) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-background px-6">
        <h2 className="font-semibold text-lg text-destructive mb-3 text-center">
          You have been logged out from this device.
        </h2>
        <p className="text-muted-foreground text-center mb-4">
          Your account is already signed in from another browser or device, or your session expired.
          If you need to use this device, please log out from other browsers first, or try signing in again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm rounded font-medium border bg-muted hover:bg-muted-foreground text-foreground"
        >
          Try Again
        </button>
      </div>
    );
  }

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
