
// This file contains helper functions for interacting with Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TasjeelRecord, AudioUploadOptions } from '@/components/tasjeel/types';

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
    responseType?: 'json' | 'blob' | 'arrayBuffer' | 'text'; // Add support for different response types
  } = {}
): Promise<T> => {
  const { 
    body, 
    headers = {}, 
    maxRetries = 3, 
    retryDelay = 1000,
    responseType = 'json' 
  } = options;
  
  let lastError: Error | null = null;
  
  console.log(`Calling edge function "${functionName}" with options:`, {
    hasBody: !!body,
    bodyType: body ? typeof body : null,
    bodyKeys: body ? Object.keys(body) : null,
    headers,
    maxRetries,
    retryDelay,
    responseType
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
  } else if (functionName === 'generate-speech' && body) {
    // Log generate-speech specific details
    console.log(`generate-speech request payload:`, {
      summaryLength: body.summary ? body.summary.length : 0,
      voice: body.voice
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
        contentType: response.headers.get('Content-Type'),
        time: `${duration}ms`
      });
      
      if (!response.ok) {
        let errorText;
        try {
          // Try to parse error as JSON first
          errorText = await response.text();
          console.error(`Error response from "${functionName}":`, errorText);
        } catch (e) {
          errorText = response.statusText;
        }
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('Content-Type');
      
      if (responseType === 'blob' || contentType?.includes('audio/') || contentType?.includes('video/') || contentType?.includes('application/octet-stream')) {
        data = await response.blob();
      } else if (responseType === 'arrayBuffer') {
        data = await response.arrayBuffer();
      } else if (responseType === 'text' || contentType?.includes('text/')) {
        data = await response.text();
      } else {
        // Default to JSON
        try {
          data = await response.json();
        } catch (e) {
          console.warn('Response was not valid JSON, returning raw text instead');
          data = await response.text();
        }
      }
      
      console.log(`Edge function "${functionName}" response received:`, {
        type: typeof data,
        isBlob: data instanceof Blob,
        isArrayBuffer: data instanceof ArrayBuffer,
        isString: typeof data === 'string'
      });
      
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

// Helper functions for Tasjeel records

// Save a new Tasjeel recording record to the database
export const saveTasjeelRecord = async (
  recordData: Omit<TasjeelRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<TasjeelRecord> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError);
      throw userError;
    }
    
    if (!userData.user) {
      throw new Error('No authenticated user found');
    }
    
    console.log('Creating Tasjeel record for user:', userData.user.id);
    
    // Make sure to include the saved field, defaulting to true
    const finalRecordData = {
      ...recordData,
      saved: recordData.saved !== undefined ? recordData.saved : true
    };
    
    const { data, error } = await supabase
      .from('tasjeel_records')
      .insert({
        ...finalRecordData,
        user_id: userData.user.id
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error saving Tasjeel record:', error);
      throw error;
    }
    
    console.log('Successfully saved Tasjeel record:', data);
    return data;
  } catch (error) {
    console.error('Error saving Tasjeel record:', error);
    throw error;
  }
};

// Update an existing Tasjeel record 
export const updateTasjeelRecord = async (
  id: string,
  updates: Partial<Omit<TasjeelRecord, 'id' | 'user_id' | 'created_at'>>
): Promise<TasjeelRecord> => {
  try {
    const { data, error } = await supabase
      .from('tasjeel_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle(); // Changed from single() to maybeSingle() to avoid errors

    if (error) {
      console.error('Error updating Tasjeel record:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('Record not found or could not be updated');
    }
    
    console.log('Successfully updated Tasjeel record:', data);
    return data;
  } catch (error) {
    console.error('Error updating Tasjeel record:', error);
    throw error;
  }
};

// Get all Tasjeel records for the current user
export const getTasjeelRecords = async (limit = 20, page = 0, savedOnly = false): Promise<TasjeelRecord[]> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError);
      throw userError;
    }
    
    if (!userData.user) {
      throw new Error('No authenticated user found');
    }
    
    console.log('Fetching Tasjeel records for user:', userData.user.id);
    
    let query = supabase
      .from('tasjeel_records')
      .select('*')
      .eq('user_id', userData.user.id);
    
    // If savedOnly is true, only return saved records
    if (savedOnly) {
      query = query.eq('saved', true);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
      console.error('Error fetching Tasjeel records:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} Tasjeel records`);
    return data || [];
  } catch (error) {
    console.error('Error fetching Tasjeel records:', error);
    throw error;
  }
};

// Delete a Tasjeel record
export const deleteTasjeelRecord = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tasjeel_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting Tasjeel record:', error);
    throw error;
  }
};

// Upload audio file function
export const uploadAudioFile = async (options: AudioUploadOptions): Promise<string> => {
  const { file, onProgress, onError, onSuccess } = options;
  
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }
    
    const fileName = `upload-${Date.now()}-${file.name}`;
    const filePath = `${userData.user.id}/${fileName}`;
    
    const { data, error } = await supabase
      .storage
      .from('tasjeel_recordings')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600'
      });
      
    if (error) throw error;
    
    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('tasjeel_recordings')
      .getPublicUrl(filePath);
    
    const audioUrl = publicUrlData.publicUrl;
    
    if (onSuccess) onSuccess(audioUrl);
    return audioUrl;
    
  } catch (error) {
    console.error('Error uploading audio file:', error);
    if (onError) onError(error);
    throw error;
  }
};

// Function to explicitly update a recording's title
export const updateRecordingTitle = async (id: string, title: string): Promise<TasjeelRecord> => {
  return updateTasjeelRecord(id, { title });
};
