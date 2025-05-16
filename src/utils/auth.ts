
import { supabase } from "@/integrations/supabase/client";
import { UserAttributes } from "@supabase/supabase-js";

// Sign out function
export async function signOut() {
  return await supabase.auth.signOut();
}

// Update profile function
export async function updateProfile(data: { user_metadata: { 
  display_name?: string; 
  avatar_url?: string;
  full_name?: string; 
} }) {
  try {
    // Convert to the format expected by Supabase
    const userData: UserAttributes = {
      data: data.user_metadata
    };
    
    const { data: updatedUser, error } = await supabase.auth.updateUser(userData);
    
    if (error) {
      throw error;
    }
    
    return updatedUser;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
}
