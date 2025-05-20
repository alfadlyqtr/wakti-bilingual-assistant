
// This file contains utility functions for debugging purposes
import { supabase } from "@/integrations/supabase/client";

/**
 * Validates the user's auth session and provides helpful debugging information
 */
export const validateAuthSession = async () => {
  try {
    console.log("[validateAuthSession] Checking authentication state...");
    
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("[validateAuthSession] Error fetching session:", sessionError);
      return {
        isAuthenticated: false,
        sessionValid: false,
        userId: null,
        error: sessionError.message
      };
    }
    
    if (!sessionData?.session) {
      console.warn("[validateAuthSession] No active session found");
      return {
        isAuthenticated: false,
        sessionValid: false,
        userId: null,
        error: "No active session"
      };
    }
    
    // Get expiration time and calculate remaining time
    const expiresAt = sessionData.session.expires_at;
    const expiresDate = new Date(expiresAt * 1000);
    const now = new Date();
    const remainingMs = expiresDate.getTime() - now.getTime();
    const remainingMins = Math.floor(remainingMs / (60 * 1000));
    
    console.log(`[validateAuthSession] Session valid for ${remainingMins} more minutes`);
    
    return {
      isAuthenticated: true,
      sessionValid: remainingMs > 0,
      userId: sessionData.session.user.id,
      email: sessionData.session.user.email,
      expiresAt: expiresDate.toISOString(),
      remainingMinutes: remainingMins,
      error: null
    };
  } catch (error) {
    console.error("[validateAuthSession] Exception validating session:", error);
    return {
      isAuthenticated: false,
      sessionValid: false,
      userId: null,
      error: String(error)
    };
  }
};
