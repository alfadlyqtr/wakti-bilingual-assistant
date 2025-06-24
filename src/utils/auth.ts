
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
    // This would typically be handled by an edge function for security
    throw new Error('Account deletion must be handled by admin');
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

export const updateUserPassword = async (password: string) => {
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    toast.success('Password updated successfully');
  } catch (error) {
    console.error('Error updating password:', error);
    toast.error('Failed to update password');
    throw error;
  }
};
