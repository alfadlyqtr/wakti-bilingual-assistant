
import { supabase } from "@/integrations/supabase/client";

// Temporary helpers during auth rebuild
export async function isLoggedIn() {
  console.log("REBUILD: Using temporary isLoggedIn helper");
  return true; // Always return true during rebuild
}

export async function refreshSession() {
  console.log("REBUILD: Using temporary refreshSession helper");
  return null; // Return null during rebuild
}
