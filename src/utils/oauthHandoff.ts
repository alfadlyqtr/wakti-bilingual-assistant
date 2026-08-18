import { supabase } from '@/integrations/supabase/client';
import { dlog } from '@/utils/debugLog';
import type { Session } from '@supabase/supabase-js';

/**
 * OAuth session handoff ("courier").
 *
 * On the Natively mobile app, Apple/Google sign-in completes in an external
 * browser window whose storage is temporary — anything saved there dies when
 * the app closes. The sign-in tokens arrive in that window's URL hash
 * (implicit flow — no code exchange exists, confirmed by server logs).
 *
 * So the external window deposits the token pair at the backend (tagged with
 * a one-time ticket), the main app window collects it and saves it into its
 * own permanent storage, and the external window discards its copy so the two
 * windows can never fight over token refresh (which would kill both).
 */

const HANDOFF_FUNCTION = 'oauth-handoff';
const HANDOFF_FLAG_KEY = 'wakti_oauth_handoff';
const SECONDARY_WINDOW_WAIT_MS = 6000;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export interface HandoffTokens {
  accessToken: string;
  refreshToken: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function markHandoffPending(ticket: string): void {
  try { sessionStorage.setItem(HANDOFF_FLAG_KEY, ticket); } catch {}
}

export function getPendingHandoffTicket(): string | null {
  try { return sessionStorage.getItem(HANDOFF_FLAG_KEY); } catch { return null; }
}

export function clearHandoffPending(): void {
  try { sessionStorage.removeItem(HANDOFF_FLAG_KEY); } catch {}
}

/** Read the token pair from the current URL hash (implicit OAuth flow). */
export function getTokensFromUrlHash(): HandoffTokens | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) return { accessToken, refreshToken };
  } catch {}
  return null;
}

async function deposit(ticket: string, tokens: HandoffTokens): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: {
        action: 'deposit',
        ticket,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      },
    });
    return !error;
  } catch {
    return false;
  }
}

async function peek(ticket: string): Promise<'pending' | 'gone'> {
  try {
    const { data, error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'peek', ticket },
    });
    if (error) return 'pending';
    return data?.status === 'gone' ? 'gone' : 'pending';
  } catch {
    return 'pending';
  }
}

async function claim(ticket: string): Promise<HandoffTokens | null> {
  try {
    const { data, error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'claim', ticket },
    });
    if (error || data?.status !== 'ready') return null;
    if (typeof data?.access_token === 'string' && typeof data?.refresh_token === 'string') {
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Secondary-window side: deposit the token pair for the main app window,
 * then watch briefly to see if it was collected.
 *
 * 'claimed'   → the main window collected it; this window must discard its copy.
 * 'unclaimed' → nobody is waiting; this window IS the app — keep the session.
 * 'failed'    → deposit never landed; caller keeps the session locally.
 */
export async function handoffSessionToMainWindow(
  ticket: string,
  tokens: HandoffTokens,
): Promise<'claimed' | 'unclaimed' | 'failed'> {
  const deposited = await deposit(ticket, tokens);
  if (!deposited) {
    dlog('handoff-deposit-failed');
    return 'failed';
  }
  dlog('handoff-tokens-deposited');

  const started = Date.now();
  while (Date.now() - started < SECONDARY_WINDOW_WAIT_MS) {
    await delay(1500);
    if ((await peek(ticket)) === 'gone') {
      dlog('handoff-collected-by-main');
      return 'claimed';
    }
  }

  // Nobody collected — withdraw the deposit (claim deletes it) and keep the session here.
  await claim(ticket);
  dlog('handoff-unclaimed-kept-here');
  return 'unclaimed';
}

/**
 * Main-window side (Natively mobile only): watch for the token pair arriving
 * from the external browser, save it into this window's permanent storage,
 * then hand the session to the caller. Stops on success or after the timeout.
 */
export function startHandoffPolling(params: {
  ticket: string;
  nextPath: string;
  onSession: (session: Session) => Promise<void>;
}): void {
  const { ticket, nextPath, onSession } = params;
  const started = Date.now();

  const timer = window.setInterval(async () => {
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      window.clearInterval(timer);
      return;
    }

    const tokens = await claim(ticket);
    if (!tokens) return;
    window.clearInterval(timer);
    clearHandoffPending();
    dlog('handoff-claimed-by-main');

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (error || !data.session) {
        dlog('handoff-apply-failed', { err: error?.message ?? 'no-session' });
        return;
      }
      await onSession(data.session);
      try {
        dlog('handoff-stored', { auth: !!localStorage.getItem('wakti-auth') });
      } catch {}

      // Soft redirect — a hard reload risks the Natively WebView error page.
      try {
        window.history.replaceState(null, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {
        window.location.href = nextPath;
      }
    } catch {}
  }, POLL_INTERVAL_MS);
}
