// This file contains helper functions for interacting with Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a single supabase client for interacting with your database
// Use environment variables if available, otherwise fall back to hardcoded values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hxauxozopvpzpdygoqwf.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU";

// Ensure that URL and key are not empty strings
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anonymous key is missing. Please check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true
  },
  global: {
    headers: {
      'x-app-name': 'WAKTI'
    }
  }
});

// Define types for edge function payloads
interface TranscribeAudioPayload {
  audioUrl: string;
  [key: string]: any;  // Allow other properties
}

interface EdgeFunctionPayload {
  [key: string]: any;
}

// Helper function to wrap Supabase functions with retry logic and detailed error logging
export const callEdgeFunctionWithRetry = async <T>(
  functionName: string,
  options: { 
    body?: EdgeFunctionPayload;
    headers?: Record<string, string>;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
): Promise<T> => {
  const { body, headers = {}, maxRetries = 3, retryDelay = 1000 } = options;
  let lastError: Error | null = null;
  
  console.log(`Calling edge function "${functionName}" with options:`, {
    hasBody: !!body,
    bodyType: body ? typeof body : null,
    bodyKeys: body ? Object.keys(body) : null,
    headers,
    maxRetries,
    retryDelay
  });
  
  // Log specific details for different functions
  if (functionName === 'transcribe-audio' && body) {
    // Type assertion for the audio body
    const audioBody = body as TranscribeAudioPayload;
    console.log(`transcribe-audio request payload:`, {
      audioUrlStart: audioBody.audioUrl ? `${audioBody.audioUrl.substring(0, 30)}...` : 'undefined',
      audioUrlLength: audioBody.audioUrl ? audioBody.audioUrl.length : 0
    });
  } else if (functionName === 'summarize-text' && body) {
    // Log summarize-text specific details
    console.log(`summarize-text request payload:`, {
      hasTranscript: !!body.transcript,
      transcriptLength: body.transcript ? body.transcript.length : 0,
      language: body.language
    });
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Edge function "${functionName}" attempt ${attempt + 1}/${maxRetries}`);
      
      let fullUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      console.log(`Using direct fetch to: ${fullUrl}`);
      
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          ...headers
        },
        body: JSON.stringify(body)
      };
      
      console.log('Fetch options:', {
        method: fetchOptions.method,
        hasBody: !!fetchOptions.body,
        headersKeys: Object.keys(fetchOptions.headers || {})
      });
      
      const startTime = Date.now();
      const response = await fetch(fullUrl, fetchOptions);
      const duration = Date.now() - startTime;
      
      console.log(`Direct fetch to "${functionName}" response:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        time: `${duration}ms`
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response from "${functionName}":`, errorText);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Edge function "${functionName}" response data:`, data);
      return data as T;
    } catch (error: any) {
      console.error(`Error calling edge function "${functionName}" (attempt ${attempt + 1}/${maxRetries}):`, error);
      console.error(`Error details:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      lastError = error as Error;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }
  
  const errorMessage = `Failed to call edge function ${functionName} after ${maxRetries} attempts`;
  console.error(errorMessage, lastError);
  throw lastError || new Error(errorMessage);
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
  
  throw lastError || new Error(`Failed to execute database operation after ${maxRetries} attempts`);
};
