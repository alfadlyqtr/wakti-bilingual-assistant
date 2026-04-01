// supabase/functions/cinema-producer/index.ts
// Wakti Cinema Producer — Shotstack API integration
// POST: Submit render (imageUrls[], scripts[], logoUrl?, contactInfo?, format, clipDuration)
// GET:  Poll render status (?renderId=xxx)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY') || '';
const SHOTSTACK_BASE = 'https://api.shotstack.io/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Shotstack HTTP helper ────────────────────────────────────────────────────
async function shotstackRequest(method: string, path: string, body?: unknown) {
  const payload = body ? JSON.stringify(body) : undefined;
  const resp = await fetch(`${SHOTSTACK_BASE}${path}`, {
    method,
    headers: {
      'x-api-key': SHOTSTACK_API_KEY,
      'Content-Type': 'application/json',
    },
    ...(payload ? { body: payload } : {}),
  });
  const data = await resp.json();
  if (resp.status >= 400) {
    throw new Error(`Shotstack ${resp.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Build Shotstack timeline ─────────────────────────────────────────────────
function buildTimeline(
  imageUrls: string[],
  scripts: string[],
  logoUrl: string | null,
  contactInfo: string | null,
  clipDuration: number,
) {
  const duration = clipDuration || 10;
  const transitionDuration = 1;
  const tracks: unknown[] = [];

  // Track 0: Image clips with zoom effect + fade transitions
  const imageClips = imageUrls.map((url, idx) => {
    const start = idx * (duration - transitionDuration);
    return {
      asset: { type: 'image', src: url },
      start,
      length: duration,
      effect: 'zoomIn',
      transition: { in: 'fade', out: 'fade' },
    };
  });
  tracks.push({ clips: imageClips });

  // Track 1: Caption clips per scene
  const captionClips = scripts
    .map((script, idx) => {
      if (!script) return null;
      const start = idx * (duration - transitionDuration) + 1;
      const textLength = Math.max(2, duration - 2);
      return {
        asset: {
          type: 'text',
          text: script,
          width: 900,
          height: 200,
          background: 'rgba(0,0,0,0)',
          color: '#FFFFFF',
          size: 30,
          style: 'future',
          position: 'bottom',
          offset: { y: -0.08 },
        },
        start,
        length: textLength,
        transition: { in: 'fade', out: 'fade' },
      };
    })
    .filter(Boolean);
  if (captionClips.length > 0) tracks.push({ clips: captionClips });

  // Track 2: Final scene overlay — contactInfo + slogan
  if (contactInfo) {
    const lastIdx = imageUrls.length - 1;
    const overlayStart = lastIdx * (duration - transitionDuration) + 2;
    tracks.push({
      clips: [
        {
          asset: {
            type: 'text',
            text: `Heritage in Motion\n${contactInfo}`,
            width: 800,
            height: 300,
            background: 'rgba(0,0,0,0)',
            color: '#E2C7A8',
            size: 36,
            style: 'future',
            position: 'center',
            offset: { y: 0.15 },
          },
          start: overlayStart,
          length: duration - 3,
          transition: { in: 'fade', out: 'fade' },
        },
      ],
    });
  }

  // Track 3: Logo overlay on final scene
  if (logoUrl) {
    const lastIdx = imageUrls.length - 1;
    const logoStart = lastIdx * (duration - transitionDuration);
    tracks.push({
      clips: [
        {
          asset: { type: 'image', src: logoUrl },
          start: logoStart,
          length: duration,
          scale: 0.25,
          position: 'topLeft',
          offset: { x: 0.02, y: -0.02 },
          transition: { in: 'fade', out: 'fade' },
        },
      ],
    });
  }

  return { soundtrack: null, background: '#000000', tracks };
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    if (!SHOTSTACK_API_KEY) {
      return jsonResponse({ error: 'SHOTSTACK_API_KEY not configured' }, 500);
    }

    // ── GET: Poll render status ──
    const url = new URL(req.url);
    const renderId = url.searchParams.get('renderId');

    if (req.method === 'GET' && renderId) {
      const data = await shotstackRequest('GET', `/render/${renderId}`);
      const r = data.response;
      return jsonResponse({
        status: r.status,
        url: r.url || null,
        progress: r.progress || 0,
        error: r.error || null,
      });
    }

    // ── POST: Submit render ──
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = await req.json();
    const {
      imageUrls,
      scripts,
      logoUrl,
      contactInfo,
      format = '9:16',
      clipDuration = 10,
    } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 1) {
      return jsonResponse({ error: 'imageUrls[] required' }, 400);
    }
    if (!scripts || !Array.isArray(scripts)) {
      return jsonResponse({ error: 'scripts[] required' }, 400);
    }

    const paddedScripts = imageUrls.map((_: string, i: number) => scripts[i] || '');
    const isPortrait = format === '9:16';

    const timeline = buildTimeline(
      imageUrls,
      paddedScripts,
      logoUrl || null,
      contactInfo || null,
      clipDuration,
    );

    const renderPayload = {
      timeline,
      output: {
        format: 'mp4',
        resolution: 'hd',
        aspectRatio: isPortrait ? '9:16' : '16:9',
        size: {
          width: isPortrait ? 720 : 1280,
          height: isPortrait ? 1280 : 720,
        },
        fps: 25,
        quality: 'high',
      },
    };

    console.log(`[cinema-producer] Submitting render: ${imageUrls.length} scenes, format=${format}`);
    const data = await shotstackRequest('POST', '/render', renderPayload);
    const id = data.response?.id;
    if (!id) throw new Error('No renderId returned from Shotstack');

    console.log(`[cinema-producer] Render submitted: ${id}`);
    return jsonResponse({ ok: true, renderId: id });
  } catch (error) {
    console.error('[cinema-producer] Error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    );
  }
});
