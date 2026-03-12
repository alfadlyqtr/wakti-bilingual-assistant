import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Instagram, Loader2 } from 'lucide-react';

/**
 * Instagram Connect Callback
 *
 * Meta redirects here after the user authorizes the app.
 * This page reads the ?code= param, stores it in sessionStorage,
 * then redirects back to the page that initiated the connect flow.
 */
export default function InstagramConnectCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const state = params.get('state');

    let returnTo = '/tools/text'; // fallback

    // Parse state to find where to redirect back
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        if (stateData.return_to) returnTo = stateData.return_to;
      } catch {
        // ignore
      }
    }

    if (error) {
      // User denied — redirect back without code
      navigate(returnTo, { replace: true });
      return;
    }

    if (code) {
      // Pass code back via URL param so InstagramPublishButton can pick it up
      navigate(`${returnTo}?ig_publish_code=${encodeURIComponent(code)}`, { replace: true });
    } else {
      navigate(returnTo, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20 border border-pink-500/30">
        <Instagram className="h-10 w-10 text-pink-500" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Connecting Instagram...</p>
    </div>
  );
}
