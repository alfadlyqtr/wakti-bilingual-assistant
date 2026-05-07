import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

type ServiceType = 'youtube' | 'gmail';

function getServiceEndpoint(service: ServiceType): string {
  switch (service) {
    case 'gmail':
      return 'gmail-oauth-callback';
    case 'youtube':
    default:
      return 'youtube-oauth-callback';
  }
}

function getServiceLabel(service: ServiceType): string {
  switch (service) {
    case 'gmail':
      return 'Gmail';
    case 'youtube':
    default:
      return 'YouTube';
  }
}

function getSuccessMessage(json: any, service: ServiceType): string {
  if (service === 'gmail' && json.email_address) {
    return `Connected to ${json.email_address}`;
  }
  if (service === 'youtube' && json.channel_title) {
    return `Connected to @${json.channel_title}`;
  }
  return `${getServiceLabel(service)} account connected!`;
}

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
      const rawCode = searchParams.get('code');
      const code = ytCode || rawCode;
      const error = searchParams.get('yt_error') || searchParams.get('error');
      const state = searchParams.get('state');

      let redirectAfter = '/studio';
      let stateAccessToken: string | null = null;
      // If Google sent back a plain 'code' (not 'yt_code'), it came directly — default to gmail
      let service: ServiceType = rawCode && !ytCode ? 'gmail' : 'youtube';

      try {
        if (state) {
          // Google may URL-encode the state — try decoding first
          const rawState = (() => { try { return decodeURIComponent(state); } catch { return state; } })();
          const decoded = JSON.parse(atob(rawState));
          if (decoded.redirect_after) redirectAfter = decoded.redirect_after;
          if (decoded.access_token) stateAccessToken = decoded.access_token;
          if (decoded.service === 'gmail' || decoded.service === 'youtube') {
            service = decoded.service;
          }
        }
      } catch { /* ignore — service already set by code-type heuristic above */ }

      const serviceLabel = getServiceLabel(service);

      if (error) {
        setStatus('error');
        setMessage(error === 'access_denied'
          ? `${serviceLabel} access was denied. You can try again from the app.`
          : `Error: ${error}`);
        setTimeout(() => navigate(redirectAfter), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received.');
        setTimeout(() => navigate(redirectAfter), 3000);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token ?? stateAccessToken;
        if (!accessToken) {
          setStatus('error');
          setMessage('You are not logged in. Please log in to Wakti first.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        const redirectUri = `${window.location.origin}/auth/google/callback`;
        const endpoint = getServiceEndpoint(service);

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
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

        if (json.error) throw new Error(json.error);

        setStatus('success');
        setMessage(getSuccessMessage(json, service));

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
            <p className="text-sm font-semibold text-foreground">Connecting...</p>
            <p className="text-xs text-muted-foreground/60">Please wait a moment</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
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
