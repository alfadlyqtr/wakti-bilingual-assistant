
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

// Get the current session
export async function getCurrentSession() {
  console.log("[AUTH_UTILS] Getting current session");
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("[AUTH_UTILS] Get session error:", error);
  }
  
  return { data, error };
}

// Get the current user
export async function getCurrentUser() {
  console.log("[AUTH_UTILS] Getting current user");
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log("[AUTH_UTILS] No active session found");
    return null;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[AUTH_UTILS] User retrieved:", user?.email);
  
  return user;
}

// Sign out the current user
export async function signOut() {
  console.log("[AUTH_UTILS] Signing out");
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error("[AUTH_UTILS] Sign out error:", error);
  }
  
  return { error };
}

// Update user profile
export async function updateProfile(profile: any) {
  console.log("[AUTH_UTILS] Updating profile");
  const { data, error } = await supabase.auth.updateUser({
    data: profile
  });
  
  if (error) {
    console.error("[AUTH_UTILS] Update profile error:", error);
  }
  
  return { user: data.user, error };
}

// Update user password
export async function updateUserPassword(password: string) {
  console.log("[AUTH_UTILS] Updating password");
  const { data, error } = await supabase.auth.updateUser({
    password
  });
  
  if (error) {
    console.error("[AUTH_UTILS] Update password error:", error);
  }
  
  return { user: data.user, error };
}

// Delete user account
export async function deleteUserAccount() {
  console.log("[AUTH_UTILS] Deleting account");
  // This would typically require a call to a Supabase Edge Function 
  // that has the service_role key to delete a user
  // For now, returning a placeholder
  
  return { error: null };
}

// Refresh session
export async function refreshSession() {
  console.log("[AUTH_UTILS] Refreshing session");
  const { data, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error("[AUTH_UTILS] Refresh session error:", error);
    return null;
  }
  
  return data.session;
}
