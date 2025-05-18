
import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts and logs the current authentication state from Supabase
 * This is useful for debugging auth issues
 */
export async function debugAuthState() {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Auth Debug: Checking current auth state`);
    
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error(`[${timestamp}] Auth Debug: Error getting session:`, sessionError);
      return { error: sessionError };
    }
    
    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error(`[${timestamp}] Auth Debug: Error getting user:`, userError);
      return { error: userError };
    }
    
    const authState = {
      hasSession: !!sessionData?.session,
      hasUser: !!userData?.user,
      userId: userData?.user?.id,
      sessionExpiry: sessionData?.session?.expires_at 
        ? new Date(sessionData.session.expires_at * 1000).toISOString()
        : null,
      // Removing the last_refresh_at property access since it doesn't exist on the Session type
      // Instead, capture the current timestamp for reference
      lastCheckedAt: timestamp
    };
    
    console.log(`[${timestamp}] Auth Debug: Current auth state:`, authState);
    return { sessionData, userData, authState };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Auth Debug: Unexpected error:`, error);
    return { error };
  }
}

/**
 * Forces a refresh of the current session
 */
export async function forceSessionRefresh() {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Auth Debug: Forcing session refresh`);
    
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error(`[${timestamp}] Auth Debug: Error refreshing session:`, error);
      return { error };
    }
    
    console.log(`[${timestamp}] Auth Debug: Session refreshed successfully:`, {
      hasSession: !!data.session,
      userId: data.user?.id,
      sessionExpiry: data.session?.expires_at 
        ? new Date(data.session.expires_at * 1000).toISOString()
        : null,
      // Using timestamp instead of accessing non-existent property
      refreshedAt: timestamp
    });
    
    return { data };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Auth Debug: Unexpected error during refresh:`, error);
    return { error };
  }
}
