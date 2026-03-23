// supabase/functions/cinema-animator/index.ts
// Wakti Cinema Animator — KIE grok-imagine I2V (10s, 720p) task creation + status polling

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

function mapKieState(state: string): string {
  switch (state?.toLowerCase()) {
    case 'success': return 'COMPLETED';
    case 'fail': return 'FAILED';
    case 'waiting':
    case 'queuing': return 'IN_QUEUE';
    case 'generating': return 'IN_PROGRESS';
    default: return 'IN_PROGRESS';
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
    const { mode } = body;

    // ── Mode: create — fire one I2V task and return task_id immediately ──
    if (mode === 'create') {
      const { image_url, prompt, scene_index } = body;
      if (!image_url) {
        return new Response(JSON.stringify({ error: 'image_url required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[cinema-animator] Creating I2V task for scene ${scene_index}`);

      const requestBody = {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: [image_url],
          duration: '10',
          resolution: '720p',
          mode: 'normal',
          ...(prompt ? { prompt: prompt.slice(0, 2500) } : {}),
        },
      };

      const res = await fetch(KIE_CREATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIE_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`KIE createTask error ${res.status}: ${err}`);
      }

      const data: KieCreateResponse = await res.json();
      console.log(`[cinema-animator] Scene ${scene_index} create response:`, JSON.stringify(data));

      if (data.code !== 200 || !data.data?.taskId) {
        throw new Error(`KIE API error: ${data.msg || data.message || 'unknown'}`);
      }

      return new Response(JSON.stringify({
        ok: true,
        task_id: data.data.taskId,
        scene_index,
        status: 'IN_QUEUE',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Mode: status — poll a single task by task_id ──
    if (mode === 'status') {
      const { task_id, scene_index } = body;
      if (!task_id) {
        return new Response(JSON.stringify({ error: 'task_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const statusRes = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(task_id)}`, {
        headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
      });

      if (!statusRes.ok) {
        const err = await statusRes.text();
        throw new Error(`KIE status error ${statusRes.status}: ${err}`);
      }

      const statusData: KieStatusResponse = await statusRes.json();
      const state = statusData.data?.state || 'generating';
      const mappedStatus = mapKieState(state);

      console.log(`[cinema-animator] Scene ${scene_index} task ${task_id} state=${state} mapped=${mappedStatus}`);

      if (mappedStatus === 'COMPLETED' && statusData.data?.resultJson) {
        const parsed = JSON.parse(statusData.data.resultJson);
        const videoUrl = (parsed.resultUrls || [])[0];
        if (videoUrl) {
          return new Response(JSON.stringify({
            ok: true, task_id, scene_index, status: 'COMPLETED', video_url: videoUrl,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (mappedStatus === 'FAILED') {
        return new Response(JSON.stringify({
          ok: false, task_id, scene_index, status: 'FAILED',
          error: statusData.data?.failMsg || 'Video generation failed',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        ok: true, task_id, scene_index, status: mappedStatus,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown mode: ${mode}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cinema-animator] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
