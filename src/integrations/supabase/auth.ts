import { supabase } from './client';
import type { Session } from '@supabase/supabase-js';

let __passportInFlight: Promise<void> | null = null;

const isSessionValid = (session: Session | null | undefined, safetySeconds = 30): boolean => {
  if (!session) return false;
  const exp = session.expires_at;
  if (!exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec > safetySeconds;
};

export async function ensurePassport(timeoutMs = 4000): Promise<void> {
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

    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || (event === 'SIGNED_IN' && session)) {
        if (isSessionValid(session)) settle(true);
      } else if (event === 'SIGNED_OUT') {
        settle(false, new Error('Signed out'));
      }
    });

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isSessionValid(session)) return settle(true);
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[Supabase] refreshSession failed (will rely on events/timeout):', msg);
        }
      } catch (error) {
        console.error('[Supabase] Error refreshing session:', error);
      }
    })();

    const timer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return settle(true);
      } catch (_e) { void _e; }
      settle(true);
    }, timeoutMs);
  });

  return __passportInFlight;
}

export async function withPassport<T>(op: () => Promise<T>): Promise<T> {
  await ensurePassport();
  return op();
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
