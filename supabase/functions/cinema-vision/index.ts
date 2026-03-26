// supabase/functions/cinema-vision/index.ts
// Wakti Cinema Visual Supervisor — Gemini Flash-Lite multimodal spatial analysis
// Input: image_url + scene_script → Output: comma-separated Spatial Motion Brief (≤50 words)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

const SYSTEM_PROMPT = `You are the Visual Supervisor for an AI Film Studio. Your job is to ensure perfect physics for the animation engine.
INPUT: 1 Image + 1 Scene Description.
YOUR GOAL: Write a 'Spatial Motion Brief' that tells the Animator exactly what is in the frame and how to move it safely.
STRICT INSTRUCTIONS:
1. Identify Subjects: List every major object and its position (e.g., 'Truck on left, Camels on right').
2. Physics Lock: Define what is SOLID (static) and what is KINETIC (moving).
3. Collision Warning: If a moving object is near a static one, give a specific order (e.g., 'Camels walk behind the truck silhouette').
4. Atmospherics: Include lighting and texture data (e.g., 'Golden hour, dust kick-up').
OUTPUT FORMAT: Comma-separated keywords and short phrases ONLY. No conversational text. Maximum 50 words.
Example Output: 'Static blue truck in foreground left, line of 5 camels in middle-ground walking right-to-left, camels passing behind truck, desert sand dunes background, low-angle tracking shot, realistic leg cycles, no pixel-tearing.'`;

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

    const { image_url, scene_script, scene_index } = await req.json();

    if (!image_url || !scene_script) {
      return new Response(JSON.stringify({ error: 'image_url and scene_script are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[cinema-vision] Analyzing scene ${scene_index}: ${image_url.slice(0, 80)}...`);

    // Fetch image as base64
    const imgResp = await fetch(image_url);
    if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
    const imgBuffer = await imgResp.arrayBuffer();
    const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const mimeType = imgResp.headers.get('content-type') || 'image/jpeg';

    // Call Gemini Flash-Lite with image + text
    const geminiBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imgBase64,
            },
          },
          {
            text: `Scene Description: "${scene_script}"\n\nAnalyze the image above and produce the Spatial Motion Brief now.`,
          },
        ],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 150,
      },
    };

    const geminiResp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResp.ok) {
      const err = await geminiResp.text();
      throw new Error(`Gemini API error ${geminiResp.status}: ${err}`);
    }

    const geminiData = await geminiResp.json();
    const brief = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!brief) throw new Error('Gemini returned empty brief');

    console.log(`[cinema-vision] Scene ${scene_index} brief: ${brief.slice(0, 120)}`);

    return new Response(JSON.stringify({
      ok: true,
      scene_index,
      brief,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cinema-vision] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
