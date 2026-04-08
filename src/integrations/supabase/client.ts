// This file contains helper functions for interacting with Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Create a single supabase client for interacting with your database
// Prefer environment variables; fall back to current values for dev safety
const supabaseUrl = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined) ||
  'https://hxauxozopvpzpdygoqwf.supabase.co'
).trim();
const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

// Use the resolved values
const effectiveUrl = supabaseUrl;
const effectiveAnon = supabaseAnonKey;

// Provide a storage object that works even when WebView blocks web storage
type MinimalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createSafeStorage(): MinimalStorage {
  // Prefer localStorage if available and writable
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const k = '__wakti_storage_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    }
  } catch (_) {}

  // Fallback to sessionStorage if available and writable
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const k = '__wakti_storage_probe__';
      window.sessionStorage.setItem(k, '1');
      window.sessionStorage.removeItem(k);
      return window.sessionStorage;
    }
  } catch (_) {}

  // Final fallback: in-memory map (per-page lifecycle)
  const mem = new Map<string, string>();
  const memoryStorage: MinimalStorage = {
    getItem: (key: string) => (mem.has(key) ? (mem.get(key) as string) : null),
    setItem: (key: string, value: string) => { mem.set(key, value); },
    removeItem: (key: string) => { mem.delete(key); },
  };
  return memoryStorage;
}

const safeStorage = createSafeStorage();

/**
 * Pre-validate and clear stale auth tokens to prevent 400 errors
 * This runs BEFORE Supabase SDK tries to auto-refresh invalid tokens
 */
export function clearStaleTokensBeforeInit(): void {
  try {
    const authData = safeStorage.getItem('wakti-auth');
    if (!authData) return; // No stored auth, nothing to clear
    
    const parsed = JSON.parse(authData);
    const expiresAt = parsed?.expires_at; // Unix timestamp in seconds
    
    if (!expiresAt) return; // No expiry info, let SDK handle it
    
    const nowSec = Math.floor(Date.now() / 1000);
    
    // If token is expired, clear it BEFORE SDK tries to refresh
    if (nowSec >= expiresAt) {
      safeStorage.removeItem('wakti-auth');
      // Also clear any other Supabase auth keys
      try {
        if (typeof window !== 'undefined') {
          for (const store of [localStorage, sessionStorage]) {
            const keys: string[] = [];
            for (let i = 0; i < store.length; i++) {
              const k = store.key(i);
              if (k?.startsWith('sb-')) keys.push(k);
            }
            keys.forEach(k => store.removeItem(k));
          }
        }
      } catch {}
    }
  } catch (error) {
    console.warn('[Auth] Error checking stale tokens:', error);
  }
}

// Disabled: Let Supabase SDK handle token refresh instead of aggressively wiping on load
// clearStaleTokensBeforeInit();

// Export the URL for use in other services
export const SUPABASE_URL = effectiveUrl;
export const SUPABASE_ANON_KEY = effectiveAnon;

export const supabase = createClient<Database>(effectiveUrl, effectiveAnon, {
  auth: {
    persistSession: true,
    // Ensure tokens refresh and session detection on redirects
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use safe storage wrapper to survive WKWebView/preview restrictions
    storage: safeStorage as any,
    storageKey: 'wakti-auth'
  }
});

/**
 * Clears all Supabase auth-related keys from localStorage
 * Used during logout to ensure clean state
 */
const clearAllSupabaseAuthKeys = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith('sb-') || k.includes('supabase') || k.startsWith('wakti-auth')
    );
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
};

/**
 * Global error handler for JWT/auth errors that slip through
 * Auto-recovers by clearing auth and redirecting to login
 */
if (typeof window !== 'undefined') {
  // Track if we're already recovering to prevent loops
  let isRecovering = false;
  
  const handleAuthError = (error: any) => {
    if (isRecovering) return;
    
    const errorStr = String(error?.message || error || '');
    const isJWTError = 
      errorStr.includes('InvalidJWTToken') ||
      errorStr.includes('Invalid value for JWT claim') ||
      errorStr.includes('JWT expired') ||
      errorStr.includes('invalid_grant') ||
      errorStr.includes('Invalid Refresh Token');
    
    if (isJWTError) {
      isRecovering = true;
      
      // Wait 2 seconds to let Supabase auto-refresh complete, then re-check
      setTimeout(async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            // Session recovered - do NOT logout
            isRecovering = false;
            return;
          }
        } catch (_) {}
        
        // Session is truly dead - now logout
        clearAllSupabaseAuthKeys();
        supabase.auth.signOut().catch(() => {});
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        isRecovering = false;
      }, 2000);
    }
  };
  
  // Catch unhandled promise rejections (where most JWT errors surface)
  window.addEventListener('unhandledrejection', (event) => {
    handleAuthError(event.reason);
  });
  
  // Also catch regular errors
  window.addEventListener('error', (event) => {
    handleAuthError(event.error);
  });
}

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

// Re-export sub-modules so existing imports from '@/integrations/supabase/client' keep working
export * from './auth';
export * from './edgeFunctions';
export * from './tasjeel';
