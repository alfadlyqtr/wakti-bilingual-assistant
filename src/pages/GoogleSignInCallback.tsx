import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getPendingHandoffTicket, handoffSessionToMainWindow } from '@/utils/oauthHandoff';
import { dlog } from '@/utils/debugLog';
import {
  clearStoredGoogleRedirect,
  finalizeGoogleSignInSession,
  getStoredGoogleRedirect,
  sanitizeGoogleRedirectPath,
  waitForGoogleSession,
} from '@/utils/googleSignIn';

export default function GoogleSignInCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { applyManualLoginRecovery } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const providerError = searchParams.get('error_description') || searchParams.get('error');
      const code = searchParams.get('code');
      const next = sanitizeGoogleRedirectPath(searchParams.get('next') || getStoredGoogleRedirect('/dashboard'));

      if (providerError) {
        clearStoredGoogleRedirect();
        setStatus('error');
        setMessage(providerError);
        window.setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        const session = await waitForGoogleSession(code);
        const loginId = searchParams.get('lid');

        // If this window did not start the sign-in, it's a secondary window
        // (external browser / temp WebView) whose storage is temporary.
        // Hand the session to the main app window instead of keeping it here.
        if (loginId && getPendingHandoffTicket() !== loginId && session.refresh_token) {
          const outcome = await handoffSessionToMainWindow(loginId, session.refresh_token);
          if (outcome === 'claimed') {
            clearStoredGoogleRedirect();
            // Discard this window's copy so it can never fight the main
            // window over token refresh (which would kill both sessions).
            dlog('temp-window-signing-out');
            try { await supabase.auth.signOut({ scope: 'local' as any }); } catch {}
            setStatus('success');
            setMessage('Signed in — you can return to the Wakti app now');
            return; // stay on this screen; the main app window continues
          }
          // 'unclaimed' / 'failed' → this window is effectively the app: keep going.
        }

        await finalizeGoogleSignInSession({
          session,
          applyManualLoginRecovery,
          loginId,
        });
        clearStoredGoogleRedirect();
        setStatus('success');
        setMessage(session.user.email || 'Google sign in successful');
        window.setTimeout(() => navigate(next, { replace: true }), 1500);
      } catch (error) {
        clearStoredGoogleRedirect();
        const text = error instanceof Error ? error.message : 'Google sign in failed';
        setStatus('error');
        setMessage(text);
        window.setTimeout(() => navigate('/login', { replace: true }), 3500);
      }
    };

    void run();
  }, [applyManualLoginRecovery, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 flex flex-col items-center gap-4 text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-foreground">Signing you in...</p>
            <p className="text-xs text-muted-foreground/60">Please wait a moment</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-400/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Welcome back</p>
            <p className="text-xs text-muted-foreground/60">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-400/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Google sign in failed</p>
            <p className="text-xs text-muted-foreground/60">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
