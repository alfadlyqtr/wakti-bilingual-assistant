
import { supabase } from "@/integrations/supabase/client";
import { UserAttributes } from "@supabase/supabase-js";

// Sign out function - removed navigation, will be handled by AuthContext
export async function signOut() {
  try {
    console.log("Auth utils: Starting sign out process");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Auth utils: Error during sign out:", error);
      throw error;
    }
    console.log("Auth utils: Successfully signed out from Supabase");
    return { error: null };
  } catch (error) {
    console.error("Auth utils: Exception during sign out:", error);
    return { error };
  }
}

// Get current session - useful for checking authentication state
export async function getCurrentSession() {
  return await supabase.auth.getSession();
}

// Get current user
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user;
}

// Update profile function
export async function updateProfile(data: { user_metadata: { 
  display_name?: string; 
  avatar_url?: string;
  full_name?: string; 
} }) {
  try {
    console.log("Updating profile with data:", data);
    
    // Convert to the format expected by Supabase
    const userData: UserAttributes = {
      data: data.user_metadata
    };
    
    const { data: updatedUser, error } = await supabase.auth.updateUser(userData);
    
    console.log("Profile update response:", { updatedUser, error });
    
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
