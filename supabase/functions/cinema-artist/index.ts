// supabase/functions/cinema-artist/index.ts
// Wakti Cinema Artist — KIE grok-imagine T2I + I2I
// Uses create/status two-call pattern to avoid edge function timeout.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KIE_API_KEY = Deno.env.get('KIE_API_KEY') || '';
const KIE_CREATE_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_STATUS_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

interface KieCreateResponse {
  code: number;
  msg?: string;
  message?: string;
  data?: { taskId: string };
}

interface KieStatusResponse {
  code: number;
  msg?: string;
  data?: {
    state: string;
    resultJson?: string;
    failMsg?: string;
  };
}

// Strip provider names from errors before sending to client
function sanitizeError(msg: string): string {
  return msg
    .replace(/KIE[\s.]*/gi, '')
    .replace(/grok[\s-]*/gi, '')
    .replace(/Shotstack[\s.]*/gi, '')
    .replace(/OpenAI[\s.]*/gi, '')
    .replace(/GPT[\s-]*/gi, '')
    .replace(/api\.kie\.ai[^\s]*/gi, 'provider')
    .replace(/createTask\s*/gi, '')
    .replace(/^[:\s-]+/, '')
    .trim() || 'Image generation failed';
}

// Map aspect_ratio to KIE-supported values
// KIE.ai wrapper only reliably accepts: 1:1, 16:9, 9:16
function mapAspectRatio(ar: string): string {
  const supported: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '16:9',   // KIE rejects 4:3 — use closest landscape
    '3:4': '9:16',   // KIE rejects 3:4 — use closest portrait
    '4:5': '9:16',   // portrait → 9:16
    '5:4': '16:9',   // landscape → 16:9
    '3:2': '16:9',
    '2:3': '9:16',
    '21:9': '16:9',
  };
  return supported[ar] || '16:9';
}

function parseImageUrls(resultJson: string): string[] {
  try {
    const parsed = JSON.parse(resultJson);
    const urls: string[] =
      parsed.resultUrls ||
      parsed.images ||
      (parsed.url ? [parsed.url] : null) ||
      (Array.isArray(parsed) ? parsed : null) ||
      [];
    return urls.filter((u: unknown) => typeof u === 'string' && (u as string).startsWith('http'));
  } catch {
    return [];
  }
}

async function kieCreateTask(model: string, input: Record<string, unknown>): Promise<string> {
  const reqBody = { model, input };
  console.log(`[cinema-artist] kieCreateTask model=${model} input_keys=${Object.keys(input).join(',')}`);
  const res = await fetch(KIE_CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIE_API_KEY}` },
    body: JSON.stringify(reqBody),
  });
  const text = await res.text();
  console.log(`[cinema-artist] createTask HTTP ${res.status}, body: ${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(`Image generation service error ${res.status}: ${text.slice(0, 100)}`);
  const data: KieCreateResponse = JSON.parse(text);
  if (data.code !== 200 || !data.data?.taskId) throw new Error(sanitizeError(data.msg || data.message || 'Image generation failed'));
  return data.data.taskId;
}

async function kieGetStatus(taskId: string): Promise<{ status: string; image_url: string | null; image_urls: string[]; error: string | null }> {
  try {
    const res = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
    });
    const text = await res.text();
    console.log('[cinema-artist] status response:', text.slice(0, 300));
    // BD-2: KIE 500 or non-ok → treat as FAILED, never throw
    if (!res.ok) {
      console.error(`[cinema-artist] KIE status non-ok ${res.status}: ${text.slice(0, 200)}`);
      return { status: 'FAILED', image_url: null, image_urls: [], error: `Image service error ${res.status}` };
    }
    const data: KieStatusResponse = JSON.parse(text);
    const state = (data.data?.state || '').toLowerCase();
    const rawResult = data.data?.resultJson || '';

    if (state === 'success' || state === 'finished' || state === 'completed') {
      const urls = rawResult ? parseImageUrls(rawResult) : [];
      return { status: 'COMPLETED', image_url: urls[0] || null, image_urls: urls, error: null };
    }
    if (state === 'fail' || state === 'failed' || state === 'error') {
      return { status: 'FAILED', image_url: null, image_urls: [], error: sanitizeError(data.data?.failMsg || 'Image generation failed') };
    }
    // waiting / queuing / generating
    return { status: 'IN_PROGRESS', image_url: null, image_urls: [], error: null };
  } catch (err) {
    // BD-2: any unexpected error → FAILED, never throw out of status check
    console.error('[cinema-artist] kieGetStatus unexpected error:', err);
    return { status: 'FAILED', image_url: null, image_urls: [], error: 'Status check failed' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { mode, prompt, anchor_url, anchor_pipeline, scene_index, aspect_ratio = '16:9', task_id } = body;

    // ── Mode: create T2I task (returns task_id immediately) ──
    if (mode === 't2i_create') {
      if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.log(`[cinema-artist] T2I create scene ${scene_index}, aspect_ratio=${aspect_ratio}`);
      // Append cinematic quality suffix — prevents image AI from defaulting to indoor/studio
      const OUTDOOR_SUFFIX = ', exterior location, outdoor natural light, cinematic photography, photorealistic, high detail, 8k';
      const hasEnvKeyword = /\b(outdoor|exterior|aerial|highway|desert|street|mountain|port|rooftop|waterfront|sky|countryside|open road|open field|open sea)\b/i.test(prompt);
      const finalPrompt = (hasEnvKeyword ? prompt : prompt + OUTDOOR_SUFFIX).slice(0, 2500);
      const safeAR = mapAspectRatio(aspect_ratio);
      const id = await kieCreateTask('grok-imagine/text-to-image', { prompt: finalPrompt, aspect_ratio: safeAR });
      return new Response(JSON.stringify({ ok: true, task_id: id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Mode: create I2I task (returns task_id immediately) ──
    // If I2I fails at KIE, auto-fallback to T2I so retry always works
    if (mode === 'i2i_create') {
      if (!prompt || !anchor_url) return new Response(JSON.stringify({ error: 'prompt and anchor_url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Pipeline-specific prompt — clean and direct, no technical wall-of-text
      let fullPrompt: string;
      if (anchor_pipeline === 'logo') {
        fullPrompt = `Integrate the provided logo/brand asset into this background scene: ${prompt}. Keep the logo pixels 100% original and unmodified. Do not redraw or alter the logo shape.`;
      } else if (anchor_pipeline === 'character') {
        fullPrompt = `Recreate the EXACT same character(s) from the reference image in a NEW scene: ${prompt}. CRITICAL: preserve the exact same art style (cartoon, anime, 3D render, realistic — whatever the reference is), same character design, same faces, same proportions, same clothing/uniforms, same color palette. Only change the ACTION and COMPOSITION to match the new scene description. Do NOT change the art style to photorealistic if the reference is cartoon/animated.`;
      } else {
        // style (default): extract color palette and lighting only
        fullPrompt = `Apply the color palette, lighting mood, and atmosphere of the reference image to this scene: ${prompt}. Do not draw the reference objects, logos, or brand marks — use only the colors and light.`;
      }
      fullPrompt = fullPrompt.slice(0, 2500);

      console.log(`[cinema-artist] I2I create scene ${scene_index}, pipeline=${anchor_pipeline}, anchor=${String(anchor_url).slice(0, 60)}`);
      try {
        const charStrength = anchor_pipeline === 'character' ? 0.35 : anchor_pipeline === 'logo' ? 0.45 : 0.55;
        const id = await kieCreateTask('grok-imagine/image-to-image', { prompt: fullPrompt, image_urls: [anchor_url], strength: charStrength });
        return new Response(JSON.stringify({ ok: true, task_id: id, scene_index }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (i2iErr) {
        // I2I failed — auto-fallback to T2I with the original scene prompt
        console.warn(`[cinema-artist] I2I FAILED, falling back to T2I for scene ${scene_index}:`, i2iErr instanceof Error ? i2iErr.message : i2iErr);
        const OUTDOOR_SUFFIX = ', exterior location, outdoor natural light, cinematic photography, photorealistic, high detail, 8k';
        const hasEnvKeyword = /\b(outdoor|exterior|aerial|highway|desert|street|mountain|port|rooftop|waterfront|sky|countryside|open road|open field|open sea)\b/i.test(prompt);
        const t2iPrompt = (hasEnvKeyword ? prompt : prompt + OUTDOOR_SUFFIX).slice(0, 2500);
        const safeAR = mapAspectRatio(aspect_ratio);
        const fallbackId = await kieCreateTask('grok-imagine/text-to-image', { prompt: t2iPrompt, aspect_ratio: safeAR });
        console.log(`[cinema-artist] T2I fallback succeeded for scene ${scene_index}, task=${fallbackId}`);
        return new Response(JSON.stringify({ ok: true, task_id: fallbackId, scene_index, fallback: 't2i' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── Mode: poll status for any image task ──
    if (mode === 'status') {
      if (!task_id) return new Response(JSON.stringify({ error: 'task_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const result = await kieGetStatus(task_id);
      return new Response(JSON.stringify({ ok: true, ...result, scene_index }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cinema-artist] Error:', error);
    const rawMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: sanitizeError(rawMsg) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
