// supabase/functions/cinema-amp/index.ts
// Wakti Cinema AMP ⚡️ — Cinematic Prompt Enhancer (gpt-4o-mini)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
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
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, context } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context block from all selected movie setup fields
    const ctxParts: string[] = [];
    if (context?.sceneCount) ctxParts.push(`Scenes: ${context.sceneCount} scenes × 10s each`);
    if (context?.vibe) ctxParts.push(`Vibe/Mood: ${context.vibe}`);
    if (context?.characters) ctxParts.push(`Cast: ${context.characters}`);
    if (context?.platform) ctxParts.push(`Platform: ${context.platform}`);
    if (context?.cta) ctxParts.push(`Goal: ${context.cta}`);
    if (context?.setting) ctxParts.push(`Setting: ${context.setting}`);
    if (context?.action) ctxParts.push(`Action: ${context.action}`);
    const contextBlock = ctxParts.length > 0
      ? `\n\nMOVIE SETUP CONTEXT (use this to tailor your enhancement):\n${ctxParts.join('\n')}`
      : '';

    const systemPrompt = `You are an ad prompt refiner for AI video generation.

Your job is to make the user's prompt clearer and more visually usable while staying EXTREMELY faithful to what they actually asked for.

You will receive the user's raw idea and movie setup context. Use the context only to sharpen the brief, not to replace it.

STRICT RULES:
1. Language Lock: Match the user's language EXACTLY. English in = English out. Arabic in = Arabic out.
2. Preserve the user's nouns, places, business type, and action beats. If they say trucking company, dry docks, company building, semi truck, highway — keep those exact ideas central.
3. Preserve sequence. If the user describes two beats or two scenes, keep that order. Example: company building at dry docks first, truck driving on highway second.
4. Do NOT invent generic cinematic filler like dawn, horizon, golden rays, cerulean sky, orchestral music, heroic poetry, or random emotional language unless the user explicitly asked for that.
5. Do NOT add extra plot, characters, symbolism, or story twists.
6. Keep it literal, commercial, and visual. Think: clean production brief for an ad, not a dramatic screenplay paragraph.
7. Use short concrete camera language only when helpful: wide shot, aerial shot, tracking shot, close-up, vertical framing.
8. If the user's input is already clear, improve wording lightly instead of rewriting heavily.
9. LENGTH: Keep output between 180 and 320 characters when possible. Never exceed 420 characters.
10. Output Format: Return ONLY the refined prompt text. No intro, no explanation, no quotes.`;

    const userMessage = text.trim() + contextBlock;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.25,
        max_tokens: 380,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI error: ${resp.status} - ${err}`);
    }

    const data = await resp.json();
    let enhanced = data.choices?.[0]?.message?.content?.trim();
    if (!enhanced) throw new Error('No content returned from OpenAI');

    // Hard server-side cap: truncate at last word boundary at or before 650 chars
    const HARD_CAP = 420;
    if (enhanced.length > HARD_CAP) {
      const cut = enhanced.slice(0, HARD_CAP);
      const lastSpace = cut.lastIndexOf(' ');
      enhanced = (lastSpace > 300 ? cut.slice(0, lastSpace) : cut).trimEnd();
      // Ensure it ends with punctuation
      if (!/[.!?]$/.test(enhanced)) enhanced += '.';
    }

    return new Response(JSON.stringify({ ok: true, enhanced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[cinema-amp] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
