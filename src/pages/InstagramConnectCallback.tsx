import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Instagram, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

/**
 * Instagram Connect Callback
 *
 * Meta redirects here after the user authorizes the app.
 * This page reads the authorization code, exchanges it directly with the backend,
 * and if the user is on Natively mobile, shows a helpful closing screen.
 * Otherwise, it automatically redirects them back to the previous screen.
 */
export default function InstagramConnectCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isNatively, setIsFromNatively] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');

      let returnTo = '/tools/text'; // fallback
      let stateOrigin: string | null = null;
      let isFromNatively = false;

      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          if (stateData.return_to) returnTo = stateData.return_to;
          if (stateData.origin) stateOrigin = stateData.origin;
          if (stateData.origin === 'https://wakti.qa') {
            isFromNatively = true;
            setIsFromNatively(true);
          }
        } catch {
          // ignore
        }
      }

      if (error) {
        setStatus('error');
        setMessage(error === 'access_denied' ? 'Access was denied. Please try again.' : `Error: ${error}`);
        if (!isFromNatively) {
          setTimeout(() => navigate(returnTo, { replace: true }), 3000);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received.');
        if (!isFromNatively) {
          setTimeout(() => navigate(returnTo, { replace: true }), 3000);
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        let localToken: string | null = null;
        try { localToken = localStorage.getItem('wakti_oauth_token'); } catch { /* ignore */ }
        const accessToken = session?.access_token ?? localToken;
        try { localStorage.removeItem('wakti_oauth_token'); } catch { /* ignore */ }

        if (!accessToken) {
          setStatus('error');
          setMessage('Session expired — please log in again and retry.');
          if (!isFromNatively) {
            setTimeout(() => navigate('/login', { replace: true }), 3000);
          }
          return;
        }

        const redirectUri = `${stateOrigin || window.location.origin}/instagram-connect-callback`;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/instagram-connect-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'exchange_code',
            code,
            redirect_uri: redirectUri,
          }),
        });

        const json = await resp.json();

        if (json.error) {
          throw new Error(json.error);
        }

        setStatus('success');
        setMessage('Instagram account connected successfully!');

        if (!isFromNatively) {
          setTimeout(() => navigate(returnTo, { replace: true }), 2000);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setStatus('error');
        setMessage(msg);
        if (!isFromNatively) {
          setTimeout(() => navigate(returnTo, { replace: true }), 4000);
        }
      }
    };

    run();
  }, [navigate, searchParams]);

  if (isNatively) {
    // Beautiful mobile success screen inside external browser
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-[#f2f2f2] px-4">
        <div className="max-w-sm w-full rounded-2xl border border-pink-500/20 bg-[#161a22] p-8 flex flex-col items-center gap-5 text-center shadow-2xl">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 border border-pink-500/30">
            <Instagram className="h-10 w-10 text-pink-500" />
          </div>
          
          {status === 'loading' && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
              <p className="text-sm font-semibold text-[#f2f2f2]">Connecting Instagram...</p>
              <p className="text-xs text-muted-foreground/60">Please hold on for a second</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-400/20 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-md font-bold text-[#f2f2f2]">Instagram Connected!</p>
              <p className="text-sm text-[#858384] leading-relaxed">
                Your account is linked. You can now <span className="font-bold text-[#f2f2f2]">close this browser tab</span> and return to the <span className="font-bold text-[#f2f2f2]">Wakti AI</span> app to publish your media.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-md font-bold text-[#f2f2f2]">Connection Failed</p>
              <p className="text-xs text-red-400">{message}</p>
              <p className="text-xs text-[#858384] leading-relaxed">Please close this window and try connecting again inside the app.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Fallback / standard redirection page
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 border border-pink-500/30">
        <Instagram className="h-10 w-10 text-pink-500 animate-pulse" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
      <p className="text-sm text-muted-foreground">
        {status === 'loading' ? 'Connecting Instagram...' : message || 'Redirecting back...'}
      </p>
    </div>
  );
}
