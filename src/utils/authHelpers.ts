
import { supabase } from "@/integrations/supabase/client";

// Check if user is logged in
export async function isLoggedIn() {
  console.log("[AUTH_HELPERS] Checking if user is logged in");
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isAuthenticated = !!session?.user;
    
    console.log("[AUTH_HELPERS] Authentication status:", isAuthenticated);
    return isAuthenticated;
  } catch (error) {
    console.error("[AUTH_HELPERS] Error checking login status:", error);
    return false;
  }
}

// Refresh the user session
export async function refreshSession() {
  console.log("[AUTH_HELPERS] Refreshing session");
  try {
    const { data } = await supabase.auth.refreshSession();
    console.log("[AUTH_HELPERS] Session refreshed:", !!data.session);
    return data.session;
  } catch (error) {
    console.error("[AUTH_HELPERS] Error refreshing session:", error);
    return null;
  }
}
