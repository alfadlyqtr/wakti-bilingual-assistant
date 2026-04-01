// supabase/functions/cinema-producer/index.ts
// Wakti Cinema Producer — Shotstack API integration
// POST: Submit render (imageUrls[], scripts[], logoUrl?, contactInfo?, format, clipDuration)
// GET:  Poll render status (?renderId=xxx)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SHOTSTACK_API_KEY = Deno.env.get('SHOTSTACK_API_KEY') || '';
const SHOTSTACK_BASE = 'https://api.shotstack.io/edit/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

// Strip provider names from errors before sending to client
function sanitizeError(msg: string): string {
  return msg
    .replace(/KIE[\s.]*/gi, '')
    .replace(/grok[\s-]*/gi, '')
    .replace(/Shotstack[\s.]*/gi, '')
    .replace(/OpenAI[\s.]*/gi, '')
    .replace(/GPT[\s-]*/gi, '')
    .replace(/api\.kie\.ai[^\s]*/gi, 'provider')
    .replace(/api\.shotstack\.io[^\s]*/gi, 'provider')
    .replace(/^[:\s-]+/, '')
    .trim() || 'Video processing failed';
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Shotstack HTTP helper ────────────────────────────────────────────────────
async function shotstackRequest(method: string, path: string, body?: unknown) {
  const payload = body ? JSON.stringify(body) : undefined;
  console.log(`[cinema-producer] Shotstack ${method} ${path}`, payload ? payload.slice(0, 500) : '(no body)');
  const resp = await fetch(`${SHOTSTACK_BASE}${path}`, {
    method,
    headers: {
      'x-api-key': SHOTSTACK_API_KEY,
      'Content-Type': 'application/json',
    },
    ...(payload ? { body: payload } : {}),
  });
  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (resp.status >= 400) {
    console.error(`[cinema-producer] Shotstack ${resp.status} response:`, text.slice(0, 1000));
    const detail = data?.message || data?.error || data?.raw || '';
    throw new Error(`Video processing service error ${resp.status}: ${detail}`);
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

// ── Build Shotstack timeline for VIDEO stitching (Grok clips) ───────────────
function buildVideoStitchTimeline(
  videoUrls: string[],
  clipDurations: number[],
  logoUrl: string | null,
) {
  const transitionDuration = 0.5;
  const tracks: unknown[] = [];

  // Track 0: Video clips sequentially with fade transitions
  const videoClips = videoUrls.map((url, idx) => {
    const dur = clipDurations[idx] || 10;
    let start = 0;
    for (let i = 0; i < idx; i++) {
      start += (clipDurations[i] || 10) - transitionDuration;
    }
    return {
      asset: { type: 'video', src: url, trim: 0 },
      start,
      length: dur,
      fit: 'cover',
      transition: { in: 'fade', out: 'fade' },
    };
  });
  tracks.push({ clips: videoClips });

  // Track 1: Logo overlay on final scene
  if (logoUrl) {
    const lastIdx = videoUrls.length - 1;
    let logoStart = 0;
    for (let i = 0; i < lastIdx; i++) {
      logoStart += (clipDurations[i] || 10) - transitionDuration;
    }
    tracks.push({
      clips: [
        {
          asset: { type: 'image', src: logoUrl },
          start: logoStart,
          length: clipDurations[lastIdx] || 10,
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
      return jsonResponse({ error: 'Video processing service not configured' }, 500);
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
      videoUrls,
      scripts,
      logoUrl,
      contactInfo,
      format = '9:16',
      clipDuration = 10,
      clipDurations,
    } = body;

    const isVideoStitch = videoUrls && Array.isArray(videoUrls) && videoUrls.length > 0;
    const isImageRender = imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0;

    if (!isVideoStitch && !isImageRender) {
      return jsonResponse({ error: 'videoUrls[] or imageUrls[] required' }, 400);
    }

    const isPortrait = format === '9:16';
    let timeline: ReturnType<typeof buildTimeline>;

    if (isVideoStitch) {
      // Video stitch mode: Grok clips → Shotstack stitches them
      const durations = clipDurations && Array.isArray(clipDurations)
        ? clipDurations
        : videoUrls.map(() => clipDuration || 10);
      timeline = buildVideoStitchTimeline(videoUrls, durations, logoUrl || null);
      console.log(`[cinema-producer] Video stitch: ${videoUrls.length} clips, format=${format}`);
      console.log(`[cinema-producer] videoUrls:`, JSON.stringify(videoUrls).slice(0, 500));
    } else {
      // Legacy image render mode
      if (!scripts || !Array.isArray(scripts)) {
        return jsonResponse({ error: 'scripts[] required' }, 400);
      }
      const paddedScripts = imageUrls.map((_: string, i: number) => scripts[i] || '');
      timeline = buildTimeline(imageUrls, paddedScripts, logoUrl || null, contactInfo || null, clipDuration);
      console.log(`[cinema-producer] Image render: ${imageUrls.length} scenes, format=${format}`);
    }

    const renderPayload = {
      timeline,
      output: {
        format: 'mp4',
        resolution: 'hd',
        aspectRatio: isPortrait ? '9:16' : '16:9',
        fps: 25,
        quality: 'medium',
      },
    };

    console.log(`[cinema-producer] Render payload output:`, JSON.stringify(renderPayload.output));
    const data = await shotstackRequest('POST', '/render', renderPayload);
    const id = data.response?.id;
    if (!id) {
      console.error('[cinema-producer] No render ID in response:', JSON.stringify(data).slice(0, 500));
      throw new Error('No render ID returned from video service');
    }

    console.log(`[cinema-producer] Render submitted: ${id}`);
    return jsonResponse({ ok: true, renderId: id });
  } catch (error) {
    console.error('[cinema-producer] Error:', error);
    const rawMsg = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { error: sanitizeError(rawMsg) },
      500,
    );
  }
});
