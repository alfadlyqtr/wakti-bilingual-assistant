import { supabase } from '@/integrations/supabase/client';
import { isNativelyApp } from '@/integrations/natively/browserBridge';
import { setActiveScopedUserId } from '@/utils/userScopedStorage';
import { clearHandoffPending, markHandoffPending, startHandoffPolling } from '@/utils/oauthHandoff';
import { dlog } from '@/utils/debugLog';
import type { Session, User } from '@supabase/supabase-js';

const PRODUCTION_ORIGIN = 'https://wakti.qa';
const APPLE_SIGN_IN_REDIRECT_KEY = 'wakti_apple_sign_in_redirect';
export const APPLE_SIGN_IN_CALLBACK_PATH = '/auth/apple/sign-in';

type ManualLoginRecovery = (recoveredUser: User, recoveredSession: Session, loginTimestamp: number) => void;

export function sanitizeAppleRedirectPath(redirectTo?: string | null): string {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/dashboard';
  }
  return redirectTo;
}

function setStoredAppleRedirect(redirectTo: string): void {
  try {
    localStorage.setItem(APPLE_SIGN_IN_REDIRECT_KEY, redirectTo);
  } catch {}
  try {
    sessionStorage.setItem(APPLE_SIGN_IN_REDIRECT_KEY, redirectTo);
  } catch {}
}

export function getStoredAppleRedirect(fallback = '/dashboard'): string {
  const safeFallback = sanitizeAppleRedirectPath(fallback);

  try {
    const localValue = localStorage.getItem(APPLE_SIGN_IN_REDIRECT_KEY);
    if (localValue) return sanitizeAppleRedirectPath(localValue);
  } catch {}

  try {
    const sessionValue = sessionStorage.getItem(APPLE_SIGN_IN_REDIRECT_KEY);
    if (sessionValue) return sanitizeAppleRedirectPath(sessionValue);
  } catch {}

  return safeFallback;
}

export function clearStoredAppleRedirect(): void {
  try {
    localStorage.removeItem(APPLE_SIGN_IN_REDIRECT_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(APPLE_SIGN_IN_REDIRECT_KEY);
  } catch {}
}

export async function startAppleSignIn(redirectTo = '/dashboard'): Promise<{ error: Error | null }> {
  const nextPath = sanitizeAppleRedirectPath(redirectTo);
  const inNatively = isNativelyApp();
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const origin = inNatively && isMobile ? PRODUCTION_ORIGIN : window.location.origin;
  const callbackUrl = new URL(APPLE_SIGN_IN_CALLBACK_PATH, origin);
  callbackUrl.searchParams.set('next', nextPath);

  // One login ceremony = one shared login_id, passed through the OAuth round trip.
  // Both the WebView and the external browser stamp the SAME id, so the
  // single-device guard never treats them as two different devices fighting.
  const loginId = crypto.randomUUID();
  callbackUrl.searchParams.set('lid', loginId);
  try { sessionStorage.setItem('wakti_login_id', loginId); } catch {}

  setStoredAppleRedirect(nextPath);
  markHandoffPending(loginId);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    } as any,
  });

  if (error) {
    clearStoredAppleRedirect();
    clearHandoffPending();
    return { error };
  }

  if (!data?.url) {
    clearStoredAppleRedirect();
    clearHandoffPending();
    return { error: new Error('Failed to start Apple sign in') };
  }

  const nativelyObj = (window as any).natively || (window as any).Natively;
  if (inNatively && isMobile && nativelyObj && typeof nativelyObj.openExternalURL === 'function') {
    nativelyObj.openExternalURL(data.url, true);
    // The login completes in an external window whose storage is temporary.
    // Collect the session here so it lands in this window's permanent storage.
    startHandoffPolling({
      ticket: loginId,
      nextPath,
      onSession: (session) => finalizeAppleSignInSession({ session, loginId }),
    });
  } else {
    window.location.href = data.url;
  }

  return { error: null };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForAppleSession(code?: string | null): Promise<Session> {
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

  throw new Error('Session expired — please try Apple sign in again.');
}

export async function finalizeAppleSignInSession(params: {
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

  dlog('finalize-apple', {
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
