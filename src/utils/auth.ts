
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
    
    return { user: updatedUser, error: null };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { user: null, error };
  }
}

// Update password function
export async function updateUserPassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({ 
      password: newPassword 
    });
    return error;
  } catch (error) {
    console.error("Error updating password:", error);
    throw error;
  }
}

// Delete account function
export async function deleteUserAccount() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { error: new Error('No active session found') };
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
      return { error: new Error(result.error || 'Failed to delete account') };
    }
    
    // Sign out the user locally after successful deletion
    await supabase.auth.signOut();
    
    return { error: null };
  } catch (error) {
    console.error("Error deleting account:", error);
    return { error };
  }
}
