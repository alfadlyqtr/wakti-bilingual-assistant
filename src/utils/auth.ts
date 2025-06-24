
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
