import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: 'YouTube API key is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let query = '';
    try {
      const body = await req.json();
      query = (body?.query || body?.q || '').toString().trim();
    } catch {}

    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const params = new URLSearchParams({
      key: YOUTUBE_API_KEY,
      part: 'snippet',
      q: query,
      type: 'video',
      videoEmbeddable: 'true',
      maxResults: '5',
      safeSearch: 'moderate'
    });

    const ytResp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

    if (!ytResp.ok) {
      const text = await ytResp.text();
      const status = ytResp.status;
      // Map common quota errors
      if (status === 403) {
        return new Response(JSON.stringify({ error: 'quota_exceeded', message: 'YouTube API quota may be exhausted.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'youtube_error', status, details: text }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await ytResp.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    const results = items
      .filter((it: any) => it?.id?.videoId && it?.snippet)
      .map((it: any) => ({
        videoId: it.id.videoId,
        title: it.snippet.title,
        description: it.snippet.description,
        thumbnail: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url || null,
        publishedAt: it.snippet.publishedAt || null
      }));

    if (results.length === 0) {
      return new Response(JSON.stringify({ results: [], message: 'no_results' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('youtube-search error', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
