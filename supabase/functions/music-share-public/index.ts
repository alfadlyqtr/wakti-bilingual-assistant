import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';

    if (!id.trim()) {
      return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('user_music_tracks')
      .select('id, created_at, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Track not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const status = (data.meta as Record<string, unknown> | null)?.status;
    if (status === 'generating' || status === 'failed' || data.storage_path?.includes('_pending.mp3')) {
      return new Response(JSON.stringify({ error: 'This track is not ready to share' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let playUrl: string | null = data.signed_url;
    if (!playUrl && data.storage_path) {
      const base = SUPABASE_URL.replace(/\/$/, '');
      const path = data.storage_path.startsWith('/') ? data.storage_path.slice(1) : data.storage_path;
      playUrl = `${base}/storage/v1/object/public/music/${path}`;
    }

    if (!playUrl) {
      return new Response(JSON.stringify({ error: 'No audio URL found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      track: {
        id: data.id,
        created_at: data.created_at,
        title: data.title,
        prompt: data.prompt,
        include_styles: data.include_styles,
        requested_duration_seconds: data.requested_duration_seconds,
        duration: data.duration,
        cover_url: data.cover_url,
        signed_url: data.signed_url,
        storage_path: data.storage_path,
        mime: data.mime,
        meta: data.meta,
      },
      play_url: playUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
