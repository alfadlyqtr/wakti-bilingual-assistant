// @ts-nocheck

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const signOut = async () => {
  try {
    console.log('Starting logout process...');
    
    // Simple, fast logout - just call Supabase auth signOut
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
      throw error;
    }
    
    console.log('Logout completed successfully');
    toast.success('Logged out successfully');
    
  } catch (error) {
    console.error('Error during logout:', error);
    toast.error('Failed to logout');
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    console.log('Starting login process for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      toast.error('Invalid email or password');
      throw error;
    }

    console.log('Login successful for:', email);
    toast.success('Welcome back!');
    
    return data;
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};

// Add back missing functions for backward compatibility
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const deleteUserAccount = async () => {
  try {
    // Use Edge Function for account deletion (requires service role to delete auth.users)
    const { data, error } = await supabase.functions.invoke('delete-user-account', {
      method: 'POST',
    });
    
    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }
    
    if (data && !data.success) {
      console.error('Deletion failed:', data.error);
      throw new Error(data.error || 'Failed to delete account');
    }
    
    toast.success('Account deleted successfully');
    return { error: null };
  } catch (error) {
    console.error('Error deleting account:', error);
    return { error };
  }
};

export const updateUserPassword = async (currentPassword: string, newPassword: string) => {
  try {
    // First get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { error: new Error('No user found') };
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { error: new Error('Current password is incorrect') };
    }

    // Current password is correct, now update to new password
    const { error: updateError } = await supabase.auth.updateUser({ 
      password: newPassword 
    });
    
    if (updateError) {
      return { error: updateError };
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error updating password:', error);
    return { error };
  }
};
