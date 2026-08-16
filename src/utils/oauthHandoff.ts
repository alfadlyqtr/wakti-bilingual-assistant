import { supabase } from '@/integrations/supabase/client';
import { dlog } from '@/utils/debugLog';
import type { Session } from '@supabase/supabase-js';

/**
 * OAuth session handoff ("courier").
 *
 * On the Natively mobile app, Apple/Google sign-in completes in an external
 * browser window whose storage is temporary — the session vanishes when the
 * app closes. This module lets that secondary window deposit the session at
 * the backend (tagged with a one-time ticket), while the main app window
 * polls and collects it into its own permanent storage.
 */

const HANDOFF_FUNCTION = 'oauth-handoff';
const HANDOFF_FLAG_KEY = 'wakti_oauth_handoff';
const SECONDARY_WINDOW_WAIT_MS = 6000;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

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

async function deposit(ticket: string, refreshToken: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'deposit', ticket, refresh_token: refreshToken },
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

async function claim(ticket: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'claim', ticket },
    });
    if (error) return null;
    return data?.status === 'ready' && data?.refresh_token ? data.refresh_token : null;
  } catch {
    return null;
  }
}

/**
 * Secondary-window side: deposit the session for the main app window, then
 * watch briefly to see if it was collected.
 *
 * 'claimed'   → the main window collected it; this window must discard its copy.
 * 'unclaimed' → nobody is waiting; this window IS the app — keep the session.
 * 'failed'    → deposit never landed; caller keeps the session locally.
 */
export async function handoffSessionToMainWindow(
  ticket: string,
  refreshToken: string,
): Promise<'claimed' | 'unclaimed' | 'failed'> {
  const deposited = await deposit(ticket, refreshToken);
  if (!deposited) {
    dlog('handoff-deposit-failed');
    return 'failed';
  }
  dlog('handoff-deposited');

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
 * Main-window side (Natively mobile only): watch for the session arriving
 * from the external browser, apply it to this window's permanent storage,
 * then hand it to the caller. Stops on success or after the timeout.
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

    const refreshToken = await claim(ticket);
    if (!refreshToken) return;
    window.clearInterval(timer);
    clearHandoffPending();
    dlog('handoff-claimed-by-main');

    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        dlog('handoff-refresh-failed', { err: error?.message ?? 'no-session' });
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
