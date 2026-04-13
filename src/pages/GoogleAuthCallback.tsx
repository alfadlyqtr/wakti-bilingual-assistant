import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const ytCode = searchParams.get('yt_code');
      const ytError = searchParams.get('yt_error');
      const state = searchParams.get('state');

      let redirectAfter = '/studio';
      try {
        if (state) {
          const decoded = JSON.parse(atob(state));
          if (decoded.redirect_after) redirectAfter = decoded.redirect_after;
        }
      } catch { /* ignore */ }

      if (ytError) {
        setStatus('error');
        setMessage(ytError === 'access_denied'
          ? 'YouTube access was denied. You can try again from the app.'
          : `Error: ${ytError}`);
        setTimeout(() => navigate(redirectAfter), 3000);
        return;
      }

      if (!ytCode) {
        setStatus('error');
        setMessage('No authorization code received.');
        setTimeout(() => navigate(redirectAfter), 3000);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setMessage('You are not logged in. Please log in to Wakti first.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        const redirectUri = `${window.location.origin}/auth/google/callback`;

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth-callback`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'exchange_code',
            code: ytCode,
            redirect_uri: redirectUri,
          }),
        });

        const json = await resp.json();

        if (json.error) throw new Error(json.error);

        setStatus('success');
        setMessage(json.channel_title
          ? `Connected to @${json.channel_title}`
          : 'YouTube account connected!');

        setTimeout(() => navigate(redirectAfter), 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setStatus('error');
        setMessage(msg);
        setTimeout(() => navigate(redirectAfter), 3000);
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 flex flex-col items-center gap-4 text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-red-400 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-foreground">Connecting YouTube...</p>
            <p className="text-xs text-muted-foreground/60">Please wait a moment</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">{message}</p>
            <p className="text-xs text-muted-foreground/60">Redirecting you back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-400/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Connection failed</p>
            <p className="text-xs text-muted-foreground/60">{message}</p>
            <p className="text-xs text-muted-foreground/40">Redirecting you back...</p>
          </>
        )}
      </div>
    </div>
  );
}
