import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearStoredAppleRedirect,
  finalizeAppleSignInSession,
  getStoredAppleRedirect,
  sanitizeAppleRedirectPath,
  waitForAppleSession,
} from '@/utils/appleSignIn';

export default function AppleSignInCallback() {
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
      const next = sanitizeAppleRedirectPath(searchParams.get('next') || getStoredAppleRedirect('/dashboard'));

      if (providerError) {
        clearStoredAppleRedirect();
        setStatus('error');
        setMessage(providerError);
        window.setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        const session = await waitForAppleSession(code);
        await finalizeAppleSignInSession({
          session,
          applyManualLoginRecovery,
          loginId: searchParams.get('lid'),
        });
        clearStoredAppleRedirect();
        setStatus('success');
        setMessage(session.user.email || 'Apple sign in successful');
        window.setTimeout(() => navigate(next, { replace: true }), 1500);
      } catch (error) {
        clearStoredAppleRedirect();
        const text = error instanceof Error ? error.message : 'Apple sign in failed';
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
            <div className="w-14 h-14 rounded-full bg-gray-500/10 border border-gray-400/20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
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
            <p className="text-sm font-semibold text-foreground">Apple sign in failed</p>
            <p className="text-xs text-muted-foreground/60">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
