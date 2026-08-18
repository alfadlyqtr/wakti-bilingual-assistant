import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { dlog } from '@/utils/debugLog';

/**
 * OAuth courier + PKCE client.
 *
 * Two device-proven facts drive this design (from client_debug_logs):
 *  1. The Natively app runs on www.wakti.qa while the OAuth callback used to
 *     be hardcoded to wakti.qa — two separate storage safes; sessions were
 *     saved in the wrong one.
 *  2. iOS strips the URL #fragment (where implicit-flow tokens ride) when
 *     handing the link from Safari to the app, but keeps the ?query.
 *
 * So Apple/Google sign-in uses PKCE: the auth code rides in the ?query and
 * survives the trip. The window that STARTS the login holds the code verifier
 * in its storage. Whoever receives the callback tries to redeem the code
 * locally; if the verifier isn't there (external browser), the code is
 * couriered to the main app window, which redeems it and saves the session
 * into the app's permanent storage.
 */

const HANDOFF_FUNCTION = 'oauth-handoff';
const HANDOFF_FLAG_KEY = 'wakti_oauth_handoff';
const SECONDARY_WINDOW_WAIT_MS = 6000;
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Dedicated PKCE client for OAuth start/exchange. Own storage key so it
 *  never fights the main client; the verifier lands in this partition's
 *  localStorage. */
export const oauthPkce = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    autoRefreshToken: false,
    persistSession: true,
    storageKey: 'wakti-oauth-pkce',
  },
});

/** Redeem an auth code in THIS window. Returns null when the code verifier
 *  isn't in this window's storage (i.e. this is an external browser window). */
export async function tryExchangeCode(code: string): Promise<Session | null> {
  try {
    const { data, error } = await oauthPkce.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      dlog('code-exchange-failed', { err: error?.message ?? 'no-session' });
      return null;
    }
    dlog('code-exchanged');
    return data.session;
  } catch (e) {
    dlog('code-exchange-threw', { err: e instanceof Error ? e.message : String(e) });
    return null;
  }
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

interface HandoffPayload {
  accessToken: string | null;
  refreshTokenOrCode: string | null;
}

async function depositCode(ticket: string, code: string): Promise<boolean> {
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

async function claim(ticket: string): Promise<HandoffPayload | null> {
  try {
    const { data, error } = await supabase.functions.invoke(HANDOFF_FUNCTION, {
      body: { action: 'claim', ticket },
    });
    if (error || data?.status !== 'ready') return null;
    return {
      accessToken: typeof data?.access_token === 'string' ? data.access_token : null,
      refreshTokenOrCode: typeof data?.refresh_token === 'string' ? data.refresh_token : null,
    };
  } catch {
    return null;
  }
}

/**
 * Secondary-window side: deposit the auth code for the main app window, then
 * watch briefly to see if it was collected.
 *
 * 'claimed'   → the main window collected it; this window is done.
 * 'unclaimed' → nobody is waiting; caller may finish locally if possible.
 * 'failed'    → deposit never landed.
 */
export async function handoffCodeToMainWindow(
  ticket: string,
  code: string,
): Promise<'claimed' | 'unclaimed' | 'failed'> {
  const deposited = await depositCode(ticket, code);
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
 * Main-window side (Natively mobile only): watch for the payload arriving
 * from the external browser, turn it into a session HERE (this window holds
 * the PKCE verifier), save it into the main client's permanent storage, then
 * hand the session to the caller. Stops on success or after the timeout.
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

    const payload = await claim(ticket);
    if (!payload || (!payload.accessToken && !payload.refreshTokenOrCode)) return;
    window.clearInterval(timer);
    clearHandoffPending();
    dlog('handoff-claimed-by-main');

    try {
      let session: Session | null = null;

      if (payload.accessToken && payload.refreshTokenOrCode) {
        // Token pair deposit (implicit-flow builds)
        const { data } = await supabase.auth.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshTokenOrCode,
        });
        session = data.session ?? null;
      } else if (payload.refreshTokenOrCode) {
        // Code deposit (PKCE): redeem here where the verifier lives
        session = await tryExchangeCode(payload.refreshTokenOrCode);
        if (session) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          try { await oauthPkce.auth.signOut({ scope: 'local' as any }); } catch {}
        }
      }

      if (!session) {
        dlog('handoff-apply-failed');
        return;
      }

      await onSession(session);
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
