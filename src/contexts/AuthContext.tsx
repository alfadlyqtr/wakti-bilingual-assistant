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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
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

  useEffect(() => {
    // Setup auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // event is a string like "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"
      (event, newSession: import('@supabase/supabase-js').Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // If the event is TOKEN_REFRESHED, update the session token in DB,
        // but do NOT enforce single-session checks during this window.
        if (event === 'TOKEN_REFRESHED' && newSession && newSession.access_token) {
          console.log('[SingleSession] TOKEN_REFRESHED: Updating token in DB and localStorage');
          isSavingSessionRef.current = true;
          saveSessionRecord(newSession.access_token).finally(() => {
            isSavingSessionRef.current = false;
            lastSessionTokenRef.current = newSession.access_token;
          });
        }
        // For login, run single-session check as usual in useEffect (see below)
      }
    );

    // Get current session at mount
    const getSession = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
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

  // ENFORCE SINGLE SESSION -- only run on new login/signup/refresh session (not token refresh)
  useEffect(() => {
    // Run if there is a user and session and we're not in the middle of saving to DB
    async function checkSingleSession() {
      if (!user || !session || !session.access_token) {
        return;
      }
      // Avoid running immediately after TOKEN_REFRESHED (when we're saving)
      if (isSavingSessionRef.current) {
        console.log('[SingleSession] Skipping enforcement: session token is being saved to DB');
        return;
      }
      // Avoid running twice for the same token
      if (lastSessionTokenRef.current === session.access_token) {
        // Already enforced this token
        return;
      }
      lastSessionTokenRef.current = session.access_token;

      setCurrentSessionToken(session.access_token);

      // Query user_sessions DB for token
      const { data, error } = await supabase
        .from('user_sessions')
        .select('session_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data || error) {
        // No row - insert (first login/device)
        await supabase.from('user_sessions').upsert([
          {
            user_id: user.id,
            session_token: session.access_token,
            device_info: window?.navigator?.userAgent ?? null,
          },
        ]);
        setCurrentSessionToken(session.access_token);
        return;
      }

      // If session_token in DB does NOT match this session's access_token
      if (data.session_token !== session.access_token) {
        // After a token refresh, the DB may be briefly stale.
        // Add a small timeout and retry.
        await new Promise(res => setTimeout(res, 350));
        // Re-query
        const { data: fresh, error: err2 } = await supabase
          .from('user_sessions')
          .select('session_token')
          .eq('user_id', user.id)
          .maybeSingle();
        if (err2) {
          showError('Unable to verify your session. Please sign in again.');
          await supabase.auth.signOut();
          clearCurrentSessionToken();
          setUser(null);
          setSession(null);
          navigate('/login');
          return;
        }
        if (fresh.session_token !== session.access_token) {
          // Still mismatched (token replaced from another device)
          showError('You have been logged out because your account was used on another device.');
          await supabase.auth.signOut();
          clearCurrentSessionToken();
          setUser(null);
          setSession(null);
          navigate('/login');
          return;
        }
      }
    }

    // Only enforce if user and session present, and not in TOKEN_REFRESHED (handled by event)
    if (user && session && session.access_token) {
      checkSingleSession();
    }
    // eslint-disable-next-line
  }, [user, session]); // DO NOT add other dependencies

  // Update session DB row and set ref accordingly
  const saveSessionRecord = async (forceSession?: string) => {
    if (user && session) {
      isSavingSessionRef.current = true;
      try {
        const sessionTyped = session as import('@supabase/supabase-js').Session;
        const token = forceSession || sessionTyped.access_token;
        if (!token) {
          console.warn("No access token found on session.");
          return;
        }
        await supabase.from('user_sessions').upsert([
          {
            user_id: user.id,
            session_token: token,
            device_info: window?.navigator?.userAgent ?? null,
          },
        ]);
        setCurrentSessionToken(token);
        lastSessionTokenRef.current = token;
      } finally {
        isSavingSessionRef.current = false;
      }
    }
  };

  const signIn = async (email: string) => {
    try {
      setLoading(true);
      const { error, data } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      // After successful login, store/replace the session DB record
      if (data?.session) {
        const sessionTyped = data.session as import('@supabase/supabase-js').Session;
        await saveSessionRecord(sessionTyped.access_token);
      }
      showSuccess("Check your email - we've sent you a magic link to sign in.");
    } catch (error: any) {
      console.error("Error signing in:", error);
      showError(error.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      if (data?.session) {
        const sessionTyped = data.session as import('@supabase/supabase-js').Session;
        await saveSessionRecord(sessionTyped.access_token);
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

  const signOut = async () => {
    try {
      setLoading(true);
      if (user) {
        await supabase.from('user_sessions').delete().eq('user_id', user.id);
      }
      await supabase.auth.signOut();
      clearCurrentSessionToken();
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
