import { supabase } from '@/integrations/supabase/client';
import { dlog } from '@/utils/debugLog';
import type { Session } from '@supabase/supabase-js';

/**
 * OAuth code handoff ("courier").
 *
 * On the Natively mobile app, Apple/Google sign-in completes in an external
 * browser window. That window receives the PKCE auth code but can never
 * exchange it — the code verifier lives in the main app window's storage.
 * So the external window deposits the code at the backend (tagged with a
 * one-time ticket), while the main app window collects it and exchanges it
 * locally, where the verifier is available. The session is born in the main
 * window's permanent storage.
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

async function deposit(ticket: string, code: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'deposit', ticket, code },
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
    if (error || data?.status !== 'ready') return null;
    const payload = data?.code ?? data?.refresh_token;
    return typeof payload === 'string' && payload ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Secondary-window side: deposit the auth code for the main app window, then
 * watch briefly to see if it was collected.
 *
 * 'claimed'   → the main window collected it; this window is done.
 * 'unclaimed' → nobody is waiting; nothing more this window can do.
 * 'failed'    → deposit never landed.
 */
export async function handoffCodeToMainWindow(
  ticket: string,
  code: string,
): Promise<'claimed' | 'unclaimed' | 'failed'> {
  const deposited = await deposit(ticket, code);
  if (!deposited) {
    dlog('handoff-deposit-failed');
    return 'failed';
  }
  dlog('handoff-code-deposited');

  const started = Date.now();
  while (Date.now() - started < SECONDARY_WINDOW_WAIT_MS) {
    await delay(1500);
    if ((await peek(ticket)) === 'gone') {
      dlog('handoff-collected-by-main');
      return 'claimed';
    }
  }

  // Nobody collected — withdraw the deposit (claim deletes it).
  await claim(ticket);
  dlog('handoff-unclaimed-withdrawn');
  return 'unclaimed';
}

/**
 * Main-window side (Natively mobile only): watch for the auth code arriving
 * from the external browser, exchange it HERE (this window holds the PKCE
 * code verifier), then hand the fresh session to the caller. Stops on
 * success or after the timeout.
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

    const code = await claim(ticket);
    if (!code) return;
    window.clearInterval(timer);
    clearHandoffPending();
    dlog('handoff-claimed-by-main');

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        dlog('handoff-exchange-failed', { err: error?.message ?? 'no-session' });
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
