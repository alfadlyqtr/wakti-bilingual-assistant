
import { supabase } from "@/integrations/supabase/client";

// Sign out function
export async function signOut() {
  return await supabase.auth.signOut();
}

// Update profile function
export async function updateProfile(data: { user_metadata: { display_name?: string; avatar_url?: string } }) {
  try {
    const { data: updatedUser, error } = await supabase.auth.updateUser(data);
    
    if (error) {
      throw error;
    }
    
    return updatedUser;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
}
