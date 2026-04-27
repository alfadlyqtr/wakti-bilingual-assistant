import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNativelyApp } from '@/integrations/natively/browserBridge';

const GOOGLE_CLIENT_ID = '255003091302-ll68065ch6fc94nkpbvd4kskq6ltl7g5.apps.googleusercontent.com';
const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

export type YouTubeConnectionState = {
  connected: boolean;
  loading: boolean;
  connecting: boolean;
  channelTitle: string | null;
  channelThumbnail: string | null;
};

export type YouTubeUploadState = 'idle' | 'uploading' | 'done' | 'error';

export function useYouTubeConnection() {
  const [connection, setConnection] = useState<YouTubeConnectionState>({
    connected: false,
    loading: true,
    connecting: false,
    channelTitle: null,
    channelThumbnail: null,
  });

  const checkConnection = useCallback(async () => {
    setConnection(prev => ({ ...prev, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setConnection({ connected: false, loading: false, connecting: false, channelTitle: null, channelThumbnail: null });
        return;
      }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth-callback`, {
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
        channelTitle: json.channel_title || null,
        channelThumbnail: json.channel_thumbnail || null,
      });
    } catch {
      setConnection({ connected: false, loading: false, connecting: false, channelTitle: null, channelThumbnail: null });
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectYouTube = useCallback(async () => {
    setConnection(prev => ({ ...prev, connecting: true }));
    try {
      const origin = window.location.origin;
      const redirectUri = `${origin}/auth/google/callback`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Please log in first');
        setConnection(prev => ({ ...prev, connecting: false }));
        return;
      }

      const state = btoa(JSON.stringify({
        origin,
        redirect_after: window.location.pathname,
        access_token: session.access_token,
      }));

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: YT_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const natively = (window as any).natively;
      if (isNativelyApp() && natively && typeof natively.openExternalURL === 'function') {
        // Enable debug temporarily so we see an alert if the native app version is too old
        natively.setDebug(true);
        natively.openExternalURL(authUrl, true);
        natively.setDebug(false);
      } else {
        window.location.href = authUrl;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start YouTube connection';
      toast.error(msg);
      setConnection(prev => ({ ...prev, connecting: false }));
    }
  }, []);

  const disconnectYouTube = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${SUPABASE_URL}/functions/v1/youtube-oauth-callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setConnection({ connected: false, loading: false, connecting: false, channelTitle: null, channelThumbnail: null });
    } catch { /* ignore */ }
  }, []);

  const uploadToYouTube = useCallback(async ({
    fileUrl,
    title,
    description = '',
    tags = [] as string[],
    privacy = 'public',
    isShort = false,
    audience = 'not_made_for_kids',
  }: {
    fileUrl: string;
    title: string;
    description?: string;
    tags?: string[];
    privacy?: 'public' | 'private' | 'unlisted';
    isShort?: boolean;
    audience?: 'made_for_kids' | 'not_made_for_kids';
  }): Promise<{ videoId: string; videoUrl: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/youtube-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_url: fileUrl,
        title,
        description,
        tags,
        privacy,
        is_short: isShort,
        audience,
      }),
    });

    const json = await resp.json();
    if (json.error) {
      if (json.reconnect_required) {
        setConnection({
          connected: false,
          loading: false,
          connecting: false,
          channelTitle: null,
          channelThumbnail: null,
        });
      }
      const err = new Error(json.error) as Error & { reconnectRequired?: boolean };
      err.reconnectRequired = !!json.reconnect_required;
      throw err;
    }
    return { videoId: json.video_id, videoUrl: json.video_url };
  }, []);

  return {
    connection,
    checkConnection,
    connectYouTube,
    disconnectYouTube,
    uploadToYouTube,
  };
}
