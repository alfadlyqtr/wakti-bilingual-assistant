
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if the user is currently logged in
 */
export async function isLoggedIn() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error("Error checking login status:", error);
    return false;
  }
}

/**
 * Forces a refresh of the current session
 */
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error("Error refreshing session:", error);
      return null;
    }
    
    return data.session;
  } catch (error) {
    console.error("Unexpected error during refresh:", error);
    return null;
  }
}
