// This file contains helper functions for interacting with Supabase
import { createClient, Session } from '@supabase/supabase-js';
import { TasjeelRecord, AudioUploadOptions } from '@/components/tasjeel/types';
import type { Database } from '@/integrations/supabase/types';

// Create a single supabase client for interacting with your database
// Prefer environment variables; fall back to current values for dev safety
const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined) ||
  'https://hxauxozopvpzpdygoqwf.supabase.co';
const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

// Use the resolved values
const effectiveUrl = supabaseUrl;
const effectiveAnon = supabaseAnonKey;

// Export the URL for use in other services
export const SUPABASE_URL = effectiveUrl;

export const supabase = createClient<Database>(effectiveUrl, effectiveAnon, {
  auth: {
    persistSession: true,
    // Ensure tokens refresh and session detection on redirects
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use stable storage + key to avoid accidental cross-app collisions
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'wakti-auth'
  }
});

// Centralized auth gate to avoid refresh storms across the app.
// - Coalesces concurrent callers into a single in-flight promise
// - Resolves when there is a valid (non-expired) session or a token refresh completes
// - Rejects cleanly on SIGNED_OUT
let __passportInFlight: Promise<void> | null = null;

const isSessionValid = (session: Session | null | undefined, safetySeconds = 30): boolean => {
  if (!session) return false;
  const exp = session.expires_at; // seconds since epoch
  if (!exp) return true; // be permissive if field missing
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec > safetySeconds;
};

export async function ensurePassport(timeoutMs = 4000): Promise<void> {
  // Fast path: if current session is valid enough, return immediately
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (isSessionValid(session)) return;
  } catch (error) {
    console.error('[Supabase] Error getting session:', error);
  }

  if (__passportInFlight) return __passportInFlight;

  __passportInFlight = new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (ok: boolean, err?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      __passportInFlight = null;
      if (ok) {
        resolve();
      } else {
        reject(err instanceof Error ? err : new Error(err ? String(err) : 'Unknown error'));
      }
    };

    const cleanup = () => {
      try { sub?.unsubscribe(); } catch (_e) { void _e; }
      try { clearTimeout(timer); } catch (_e) { void _e; }
    };

    // Listen for auth changes that indicate readiness
    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && session)) {
        // Extra guard: validate session freshness
        if (isSessionValid(session)) settle(true);
      } else if (event === 'SIGNED_OUT') {
        settle(false, new Error('Signed out'));
      }
    });

    // Kick the tires: if we already have a near-valid session, resolve; otherwise, try a single refresh
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isSessionValid(session)) return settle(true);
        // Attempt an explicit one-off refresh to avoid multiple implicit refreshers elsewhere
        try {
          await supabase.auth.refreshSession();
          // Resolution will occur via TOKEN_REFRESHED event listener
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[Supabase] refreshSession failed (will rely on events/timeout):', msg);
        }
      } catch (error) {
        console.error('[Supabase] Error refreshing session:', error);
      }
    })();

    // Final fallback: timeout to avoid hanging callers
    const timer = setTimeout(async () => {
      try {
        // As a last check, if we do have any session at all, allow progress to avoid deadlocks
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return settle(true);
      } catch (_e) { void _e; }
      settle(true); // allow proceed; downstream calls may handle 401s
    }, timeoutMs);
  });

  return __passportInFlight;
}

export async function withPassport<T>(op: () => Promise<T>): Promise<T> {
  await ensurePassport();
  return op();
}

// Lightweight helper to get current user id without hitting network
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// One-time connectivity check (no UI impact). Logs minimal status to console.
declare global {
  interface Window { __SUPABASE_CHECKED__?: boolean }
}

if (typeof window !== 'undefined' && !window.__SUPABASE_CHECKED__) {
  window.__SUPABASE_CHECKED__ = true;
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('[Supabase] Connectivity check failed:', error?.message || error);
      } else {
        console.log('[Supabase] Client initialized. Session present:', !!data?.session);
      }
    })
    .catch((e) => console.error('[Supabase] Connectivity error:', e?.message || e));
}

// Define types for edge function payloads
interface TranscribeAudioPayload {
  audioUrl: string;
  [key: string]: unknown;  // Allow other properties
}

type EdgeFunctionPayload = Record<string, unknown>;

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
    const sBody = body as { transcript?: string; language?: string };
    console.log(`summarize-text request payload:`, {
      hasTranscript: !!sBody.transcript,
      transcriptLength: sBody.transcript ? sBody.transcript.length : 0,
      language: sBody.language
    });
  } else if (functionName === 'generate-speech' && body) {
    // Log generate-speech specific details
    const gBody = body as { summary?: string; voice?: string };
    console.log(`generate-speech request payload:`, {
      summaryLength: gBody.summary ? gBody.summary.length : 0,
      voice: gBody.voice
    });
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Edge function "${functionName}" attempt ${attempt + 1}/${maxRetries}`);
      
      const fullUrl = `${effectiveUrl}/functions/v1/${functionName}`;
      console.log(`Using direct fetch to: ${fullUrl}`);
      
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveAnon}`,
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error calling edge function "${functionName}" (attempt ${attempt + 1}/${maxRetries}):`, err);
      console.error(`Error details:`, {
        message: err.message,
        name: err.name,
        stack: err.stack?.split('\n').slice(0, 3).join('\n')
      });
      lastError = err;
      
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

// Function to manually trigger auto-delete of old recordings
export const manuallyDeleteOldRecordings = async (): Promise<{ success: boolean; message: string; deletedCount?: number }> => {
  try {
    console.log('Manually triggering auto-delete of old recordings...');
    
    const data = await callEdgeFunctionWithRetry<{
      message: string;
      deleted_count: number;
      deleted_recordings?: Array<{ id: string; title: string; created_at: string }>;
    }>('auto-delete-recordings', {
      body: {},
      maxRetries: 1,
      retryDelay: 1000
    });

    console.log('Auto-delete function result:', data);
    
    return {
      success: true,
      message: data.message,
      deletedCount: data.deleted_count
    };
  } catch (error) {
    console.error('Error manually deleting old recordings:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete old recordings';
    return {
      success: false,
      message
    };
  }
};

// Map DB row -> domain TasjeelRecord (coerces nullables to domain invariants)
const mapDbTasjeelRecord = (row: Database['public']['Tables']['tasjeel_records']['Row']): TasjeelRecord => {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title ?? null,
    original_recording_path: String(row.original_recording_path),
    transcription: row.transcription ?? null,
    summary: row.summary ?? null,
    summary_audio_path: row.summary_audio_path ?? null,
    duration: row.duration ?? null,
    saved: row.saved ?? false,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? undefined,
    source_type: (row.source_type as TasjeelRecord['source_type']) ?? 'recording'
  };
};

// Helper functions for Tasjeel records

// Save a new Tasjeel recording record to the database
export const saveTasjeelRecord = async (
  recordData: Omit<TasjeelRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<TasjeelRecord> => {
  try {
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user found');
    }
    
    console.log('Creating Tasjeel record for user:', userId);
    
    // Make sure to include the saved field, defaulting to true
    const finalRecordData = {
      ...recordData,
      saved: recordData.saved !== undefined ? recordData.saved : true
    };
    
    const { data, error } = await supabase
      .from('tasjeel_records')
      .insert({
        ...finalRecordData,
        user_id: userId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error saving Tasjeel record:', error);
      throw error;
    }
    
    console.log('Successfully saved Tasjeel record:', data);
    return mapDbTasjeelRecord(data);
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
    return mapDbTasjeelRecord(data);
  } catch (error) {
    console.error('Error updating Tasjeel record:', error);
    throw error;
  }
};

// Get all Tasjeel records for the current user
export const getTasjeelRecords = async (limit = 20, page = 0, savedOnly = false): Promise<TasjeelRecord[]> => {
  try {
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('No authenticated user found');
    }
    
    console.log('Fetching Tasjeel records for user:', userId);
    
    let query = supabase
      .from('tasjeel_records')
      .select('*')
      .eq('user_id', userId);
    
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
    return (data || []).map(mapDbTasjeelRecord);
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
    await ensurePassport();
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const fileName = `upload-${Date.now()}-${file.name}`;
    const filePath = `${userId}/${fileName}`;
    
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

// Server-only admin client factory. Do NOT call from the browser.
export function getAdminSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getAdminSupabaseClient() cannot be used in the browser. Use Edge Functions or server runtime.');
  }
  const adminKey =
    (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined) ||
    (typeof process !== 'undefined' ? (process as any).env?.SUPABASE_SERVICE_ROLE : undefined);

  const url =
    (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    effectiveUrl;

  if (!url || !adminKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client. Configure these in your server/Edge environment.');
  }
  return createClient(url, adminKey, { auth: { persistSession: false } });
}
