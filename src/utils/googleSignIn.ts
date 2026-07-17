import { supabase } from '@/integrations/supabase/client';
import { isNativelyApp } from '@/integrations/natively/browserBridge';
import { setActiveScopedUserId } from '@/utils/userScopedStorage';
import type { Session, User } from '@supabase/supabase-js';

const PRODUCTION_ORIGIN = 'https://wakti.qa';
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
  const origin = inNatively && isMobile ? PRODUCTION_ORIGIN : window.location.origin;
  const callbackUrl = new URL(GOOGLE_SIGN_IN_CALLBACK_PATH, origin);
  callbackUrl.searchParams.set('next', nextPath);

  setStoredGoogleRedirect(nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    } as any,
  });

  if (error) {
    clearStoredGoogleRedirect();
    return { error };
  }

  if (!data?.url) {
    clearStoredGoogleRedirect();
    return { error: new Error('Failed to start Google sign in') };
  }

  const nativelyObj = (window as any).natively || (window as any).Natively;
  if (inNatively && isMobile && nativelyObj && typeof nativelyObj.openExternalURL === 'function') {
    nativelyObj.openExternalURL(data.url, true);
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
}): Promise<void> {
  const { session, applyManualLoginRecovery } = params;
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

  try {
    applyManualLoginRecovery?.(session.user, session, loginTimestamp);
  } catch {}

  try {
    const loginId = crypto.randomUUID();
    try {
      sessionStorage.setItem('wakti_login_id', loginId);
    } catch {}
    Promise.resolve(
      supabase
        .from('user_active_sessions')
        .upsert({
          user_id: session.user.id,
          session_id: session.access_token,
          login_id: loginId,
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
