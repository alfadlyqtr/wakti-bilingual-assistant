
// This file contains helper functions for interacting with Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a single supabase client for interacting with your database
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to wrap Supabase functions with retry logic
export const callEdgeFunctionWithRetry = async <T>(
  functionName: string,
  options: { 
    body?: object;
    headers?: Record<string, string>;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<T> => {
  const { body, headers = {}, maxRetries = 3, retryDelay = 1000 } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body,
        headers: headers
      });
      
      if (error) {
        console.error(`Edge function error (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      return data as T;
    } catch (error) {
      console.error(`Network error calling edge function (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error as Error;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }
  
  throw lastError || new Error(`Failed to call edge function ${functionName} after ${maxRetries} attempts`);
};

// Helper function for database operations with retry
export const withRetry = async <T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await operation();
      
      if (error) {
        console.error(`Database operation error (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
      
      if (data === null) {
        throw new Error('Operation returned null data');
      }
      
      return data as T;
    } catch (error) {
      console.error(`Error in database operation (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error as Error;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }
  
  throw lastError || new Error(`Failed database operation after ${maxRetries} attempts`);
};
