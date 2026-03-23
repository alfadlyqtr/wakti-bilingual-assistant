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

function parseImageUrl(resultJson: string): string | null {
  try {
    const parsed = JSON.parse(resultJson);
    const urls: string[] =
      parsed.resultUrls ||
      parsed.images ||
      (parsed.url ? [parsed.url] : null) ||
      (Array.isArray(parsed) ? parsed : null) ||
      [];
    return urls.find((u: unknown) => typeof u === 'string' && (u as string).startsWith('http')) || null;
  } catch {
    return null;
  }
}

async function kieCreateTask(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(KIE_CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KIE_API_KEY}` },
    body: JSON.stringify({ model, input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`KIE createTask ${res.status}: ${text}`);
  const data: KieCreateResponse = JSON.parse(text);
  console.log('[cinema-artist] createTask response:', text.slice(0, 200));
  if (data.code !== 200 || !data.data?.taskId) throw new Error(`KIE error: ${data.msg || data.message || 'no taskId'}`);
  return data.data.taskId;
}

async function kieGetStatus(taskId: string): Promise<{ status: string; image_url: string | null; error: string | null }> {
  const res = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
  });
  const text = await res.text();
  console.log('[cinema-artist] status response:', text.slice(0, 300));
  if (!res.ok) throw new Error(`KIE status ${res.status}: ${text}`);
  const data: KieStatusResponse = JSON.parse(text);
  const state = (data.data?.state || '').toLowerCase();
  const rawResult = data.data?.resultJson || '';

  if (state === 'success' || state === 'finished' || state === 'completed') {
    const url = rawResult ? parseImageUrl(rawResult) : null;
    return { status: 'COMPLETED', image_url: url, error: null };
  }
  if (state === 'fail' || state === 'failed' || state === 'error') {
    return { status: 'FAILED', image_url: null, error: data.data?.failMsg || 'KIE task failed' };
  }
  // waiting / queuing / generating
  return { status: 'IN_PROGRESS', image_url: null, error: null };
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
    const { mode, prompt, anchor_url, scene_index, aspect_ratio = '16:9', task_id, visual_dna } = body;

    // ── Mode: create T2I task (returns task_id immediately) ──
    if (mode === 't2i_create') {
      if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.log(`[cinema-artist] T2I create, aspect_ratio=${aspect_ratio}`);
      const id = await kieCreateTask('grok-imagine/text-to-image', { prompt: prompt.slice(0, 2500), aspect_ratio });
      return new Response(JSON.stringify({ ok: true, task_id: id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Mode: create I2I task (returns task_id immediately) ──
    if (mode === 'i2i_create') {
      if (!prompt || !anchor_url) return new Response(JSON.stringify({ error: 'prompt and anchor_url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      // Prepend visual DNA from Scene 1 to enforce consistency
      const fullPrompt = visual_dna
        ? `[VISUAL DNA — keep identical style]: ${visual_dna}\n\n[SCENE ACTION]: ${prompt}`.slice(0, 2500)
        : prompt.slice(0, 2500);
      console.log(`[cinema-artist] I2I create scene ${scene_index}, anchor=${String(anchor_url).slice(0, 60)}, prompt=${fullPrompt.slice(0, 100)}`);
      const id = await kieCreateTask('grok-imagine/image-to-image', { prompt: fullPrompt, image_urls: [anchor_url], strength: 0.55 });
      return new Response(JSON.stringify({ ok: true, task_id: id, scene_index }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
