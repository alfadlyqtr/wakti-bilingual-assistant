import { supabase } from '@/integrations/supabase/client';
import { isNativelyApp } from '@/integrations/natively/browserBridge';
import { setActiveScopedUserId } from '@/utils/userScopedStorage';
import { clearHandoffPending, markHandoffPending, oauthPkce, startHandoffPolling } from '@/utils/oauthHandoff';
import { dlog } from '@/utils/debugLog';
import type { Session, User } from '@supabase/supabase-js';

const GOOGLE_SIGN_IN_REDIRECT_KEY = 'wakti_google_sign_in_redirect';
export const GOOGLE_SIGN_IN_CALLBACK_PATH = '/auth/google/sign-in';

type ManualLoginRecovery = (recoveredUser: User, recoveredSession: Session, loginTimestamp: number) => void;

export function sanitizeGoogleRedirectPath(redirectTo?: string | null): string {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/dashboard';
  }
  return redirectTo;
}

function setStoredGoogleRedirect(redirectTo: string): void {
  try {
    localStorage.setItem(GOOGLE_SIGN_IN_REDIRECT_KEY, redirectTo);
  } catch {}
  try {
    sessionStorage.setItem(GOOGLE_SIGN_IN_REDIRECT_KEY, redirectTo);
  } catch {}
}

export function getStoredGoogleRedirect(fallback = '/dashboard'): string {
  const safeFallback = sanitizeGoogleRedirectPath(fallback);

  try {
    const localValue = localStorage.getItem(GOOGLE_SIGN_IN_REDIRECT_KEY);
    if (localValue) return sanitizeGoogleRedirectPath(localValue);
  } catch {}

  try {
    const sessionValue = sessionStorage.getItem(GOOGLE_SIGN_IN_REDIRECT_KEY);
    if (sessionValue) return sanitizeGoogleRedirectPath(sessionValue);
  } catch {}

  return safeFallback;
}

export function clearStoredGoogleRedirect(): void {
  try {
    localStorage.removeItem(GOOGLE_SIGN_IN_REDIRECT_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(GOOGLE_SIGN_IN_REDIRECT_KEY);
  } catch {}
}

export async function startGoogleSignIn(redirectTo = '/dashboard'): Promise<{ error: Error | null }> {
  const nextPath = sanitizeGoogleRedirectPath(redirectTo);
  const inNatively = isNativelyApp();
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  // Pin the callback to the canonical origin (www.wakti.qa) — the same storage
  // partition the app boots from (proven by device logs: sessions saved on the
  // non-www partition are invisible at reopen). localhost stays for dev.
  const origin = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? window.location.origin
    : 'https://www.wakti.qa';
  const callbackUrl = new URL(GOOGLE_SIGN_IN_CALLBACK_PATH, origin);
  callbackUrl.searchParams.set('next', nextPath);

  // One login ceremony = one shared login_id, passed through the OAuth round trip.
  // Both the WebView and the external browser stamp the SAME id, so the
  // single-device guard never treats them as two different devices fighting.
  const loginId = crypto.randomUUID();
  callbackUrl.searchParams.set('lid', loginId);
  try { sessionStorage.setItem('wakti_login_id', loginId); } catch {}

  setStoredGoogleRedirect(nextPath);
  markHandoffPending(loginId);

  // PKCE: the auth code comes back in the ?query, which survives the iOS
  // handoff from Safari to the app (the #fragment used by implicit flow gets
  // stripped — the core of the lost-session bug).
  const { data, error } = await oauthPkce.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    clearStoredGoogleRedirect();
    clearHandoffPending();
    return { error };
  }

  if (!data?.url) {
    clearStoredGoogleRedirect();
    return { error: new Error('Failed to start Google sign in') };
  }

  const nativelyObj = (window as any).natively || (window as any).Natively;
  if (inNatively && isMobile && nativelyObj && typeof nativelyObj.openExternalURL === 'function') {
    nativelyObj.openExternalURL(data.url, true);
    // The login completes in an external window whose storage is temporary.
    // Collect the session here so it lands in this window's permanent storage.
    startHandoffPolling({
      ticket: loginId,
      nextPath,
      onSession: (session) => finalizeGoogleSignInSession({ session, loginId }),
    });
  } else {
    window.location.href = data.url;
  }

  return { error: null };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForGoogleSession(code?: string | null): Promise<Session> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await delay(200);
  }

  if (code && typeof (supabase.auth as any).exchangeCodeForSession === 'function') {
    const { error } = await (supabase.auth as any).exchangeCodeForSession(code);
    if (error) {
      const message = String(error.message || '').toLowerCase();
      const ignorable = message.includes('code verifier') || message.includes('flow state') || message.includes('already');
      if (!ignorable) {
        throw error;
      }
    }
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await delay(250);
  }

  throw new Error('Session expired — please try Google sign in again.');
}

export async function finalizeGoogleSignInSession(params: {
  session: Session;
  applyManualLoginRecovery?: ManualLoginRecovery;
  loginId?: string | null;
}): Promise<void> {
  const { session, applyManualLoginRecovery, loginId } = params;
  const loginTimestamp = Date.now();

  try {
    localStorage.setItem('wakti_recent_login', String(loginTimestamp));
  } catch {}
  try {
    sessionStorage.setItem('wakti_recent_login', String(loginTimestamp));
  } catch {}

  try {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch {}

  dlog('finalize-google', {
    rt: !!session.refresh_token,
    stored: (() => { try { return !!localStorage.getItem('wakti-auth'); } catch { return null; } })(),
  });

  // Stamp the shared ceremony login_id BEFORE waking AuthContext, so the
  // single-device monitor arms with the correct id (no self-kick race).
  const effectiveLoginId = loginId || crypto.randomUUID();
  try {
    sessionStorage.setItem('wakti_login_id', effectiveLoginId);
  } catch {}

  try {
    applyManualLoginRecovery?.(session.user, session, loginTimestamp);
  } catch {}

  try {
    Promise.resolve(
      supabase
        .from('user_active_sessions')
        .upsert({
          user_id: session.user.id,
          session_id: session.access_token,
          login_id: effectiveLoginId,
          last_login: new Date().toISOString(),
          device_info: navigator.userAgent || 'Unknown Device',
        })
    ).catch(() => {});
  } catch {}

  setActiveScopedUserId(session.user.id);

  Promise.resolve(
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
  )
    .then(({ data: profileData }) => {
      if (!profileData) return;
      try {
        localStorage.setItem(
          `wakti_profile_${session.user.id}`,
          JSON.stringify({ data: profileData, _cachedAt: Date.now() }),
        );
        window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
      } catch {}
    })
    .catch(() => {});
}
