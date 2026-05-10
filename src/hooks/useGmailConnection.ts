import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNativelyApp } from '@/integrations/natively/browserBridge';

const PRODUCTION_ORIGIN = 'https://wakti.qa';

const GOOGLE_CLIENT_ID = '255003091302-ll68065ch6fc94nkpbvd4kskq6ltl7g5.apps.googleusercontent.com';
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

export type GmailConnectionState = {
  connected: boolean;
  loading: boolean;
  connecting: boolean;
  emailAddress: string | null;
};

export function useGmailConnection() {
  const [connection, setConnection] = useState<GmailConnectionState>({
    connected: false,
    loading: true,
    connecting: false,
    emailAddress: null,
  });

  const checkConnection = useCallback(async () => {
    setConnection(prev => ({ ...prev, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConnection({ connected: false, loading: false, connecting: false, emailAddress: null });
        return;
      }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth-callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'check_connection' }),
      });
      const json = await resp.json();
      setConnection({
        connected: !!json.connected,
        loading: false,
        connecting: false,
        emailAddress: json.email_address || null,
      });
    } catch {
      setConnection({ connected: false, loading: false, connecting: false, emailAddress: null });
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // When the app/page regains focus (e.g. user returns from external OAuth browser),
  // re-check the Gmail connection so 'connecting' / 'Opening...' state unsticks.
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };
    const handleFocus = () => {
      checkConnection();
    };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkConnection]);

  // Hard watchdog: if we've been 'connecting' for more than 2 minutes, reset.
  useEffect(() => {
    if (!connection.connecting) return;
    const timeoutId = setTimeout(() => {
      setConnection(prev => (prev.connecting ? { ...prev, connecting: false } : prev));
      checkConnection();
    }, 2 * 60 * 1000);
    return () => clearTimeout(timeoutId);
  }, [connection.connecting, checkConnection]);

  const initiateGmailAuth = useCallback(async () => {
    console.log('[Gmail] initiateGmailAuth called');
    setConnection(prev => ({ ...prev, connecting: true }));
    try {
      const inNatively = isNativelyApp();
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      // Mobile Natively: OAuth opens in system Safari → must redirect to production domain.
      // Desktop (browser or desktop Natively): OAuth stays in same WebView → use current origin.
      const origin = (inNatively && isMobile) ? PRODUCTION_ORIGIN : window.location.origin;
      const redirectUri = `${origin}/auth/google/callback`;
      console.log('[Gmail] redirectUri:', redirectUri, '| inNatively:', inNatively, '| isMobile:', isMobile);

      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Gmail] session:', session ? 'found' : 'null');

      if (!session) {
        toast.error('Please log in first');
        setConnection(prev => ({ ...prev, connecting: false }));
        return;
      }

      const state = btoa(JSON.stringify({
        origin,
        redirect_after: window.location.pathname,
        access_token: session.access_token,
        service: 'gmail',
      }));

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GMAIL_SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      console.log('[Gmail] navigating to Google:', authUrl.substring(0, 80) + '...');

      // Store token in localStorage as fallback for mobile Safari round-trip
      // (session is lost when coming back from external browser into WebView)
      try { localStorage.setItem('wakti_oauth_token', session.access_token); } catch { /* ignore */ }

      // On mobile (iOS/Android) Natively, Google blocks OAuth in WebViews — must use system browser.
      // On desktop Natively, openExternalURL opens system browser and the callback lands there (not in app) — use window.location.href instead.
      const isMobileNatively = inNatively && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      const nativelyObj = (window as any).natively;
      if (isMobileNatively && nativelyObj && typeof nativelyObj.openExternalURL === 'function') {
        console.log('[Gmail] mobile Natively — using openExternalURL');
        nativelyObj.openExternalURL(authUrl, true);
      } else {
        console.log('[Gmail] using window.location.href (desktop or browser)');
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error('[Gmail] initiateGmailAuth error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start Gmail connection';
      toast.error(msg);
      setConnection(prev => ({ ...prev, connecting: false }));
    }
  }, []);

  const disconnectGmail = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth-callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setConnection({ connected: false, loading: false, connecting: false, emailAddress: null });
    } catch { /* ignore */ }
  }, []);

  return {
    connection,
    checkConnection,
    initiateGmailAuth,
    disconnectGmail,
  };
}
