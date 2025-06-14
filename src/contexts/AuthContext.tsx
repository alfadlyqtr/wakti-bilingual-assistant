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

  // Remove sessionMismatch, session token, and validation complexity.
  // We only track is_logged_in flag now.
  const [loginBlockedEmail, setLoginBlockedEmail] = useState<string | null>(null);

  // Updated simple single-session sign-in
  const signIn = async (email: string) => {
    try {
      setLoading(true);
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        // Block login, but allow user to force logout others.
        setLoginBlockedEmail(email);
        showError("Your account is already signed in elsewhere.");
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

  // Added force logout function—sets is_logged_in to false and retries sign-in
  const forceLogoutAndContinue = async () => {
    if (!loginBlockedEmail) return;
    try {
      setLoading(true);
      // Set is_logged_in to false for this email
      await supabase.from('profiles').update({ is_logged_in: false }).ilike('email', loginBlockedEmail);
      showSuccess("Signed out elsewhere. You can now log in.");
      setLoginBlockedEmail(null);
      // After forcing logout, try sign-in again
      await signIn(loginBlockedEmail);
    } catch (err: any) {
      showError("Could not force logout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password sign-in, block by is_logged_in but allow force logout
  const signInWithPassword = async (email: string, password: string) => {
    try {
      setLoading(true);
      const profile = await fetchProfileByEmail(email);
      if (profile && profile.is_logged_in) {
        setLoginBlockedEmail(email);
        showError("Your account is already signed in elsewhere.");
        setLoading(false);
        return;
      }
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user && data.session) {
        // Set profile online
        await supabase.from('profiles').update({ is_logged_in: true }).eq('id', data.user.id);
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

  // On sign up, set is_logged_in to true if session exists
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
      showSuccess("Check your email - we've sent you a confirmation link to verify your email.");
      setUser(data.user);
    } catch (error: any) {
      console.error("Error signing up:", error);
      showError(error.message || "Failed to sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Set profile offline on sign out
  const signOut = async (options?: { preventProfileUpdate?: boolean }) => {
    try {
      setLoading(true);
      if (user && !options?.preventProfileUpdate) {
        await supabase.from('profiles').update({ is_logged_in: false }).eq('id', user.id);
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setLoginBlockedEmail(null);
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

  // Listen for auth state changes ONLY to keep user/session in sync
  // Remove validation logic entirely (no session freezing)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    // Restore session, don't validate anything extra
    const getSession = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
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

  // Show force-logout prompt if blocked by is_logged_in flag
  const forceLogoutModal = loginBlockedEmail ? (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-xl max-w-xs text-center flex flex-col gap-4 shadow-lg border border-muted">
        <h2 className="font-semibold text-lg text-destructive">
          Already signed in elsewhere
        </h2>
        <p className="text-muted-foreground text-sm">
          This account is signed in on another device or browser.<br />
          To continue, you can force logout other sessions and sign in here.
        </p>
        <button
          onClick={forceLogoutAndContinue}
          className="w-full rounded px-4 py-2 bg-primary text-white font-semibold shadow hover:bg-accent"
        >
          Log out other devices & Continue
        </button>
        <button
          onClick={() => setLoginBlockedEmail(null)}
          className="w-full px-4 py-2 text-muted-foreground hover:text-foreground bg-muted rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  const contextValue = {
    user,
    session,
    loading,
    isLoading: loading,
    signIn,
    signInWithPassword,
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
      {forceLogoutModal}
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
