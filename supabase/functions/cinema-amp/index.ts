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

    const systemPrompt = `You are a Cinematic Prompt Engineer for a high-end AI Video Studio. Enhance the user's idea into a visually rich, cinematic description.

You will receive the user's raw idea AND their movie setup selections (scene count, vibe, cast, platform, goals, etc.). Your job is to WEAVE all of that context naturally into one cohesive cinematic description. Do NOT list the selections — absorb them into the visual storytelling.

STRICT RULES:
1. Language Lock: Match the user's language EXACTLY. English in = English out. Arabic in = Arabic out. ZERO tolerance for any other language — Spanish, French, or any other language is a critical failure.
2. Visuals Only: Add cinematic language — lighting, camera angles, mood, lens types, time of day. Make it visual poetry.
3. POSITIVE DESCRIPTIONS ONLY: Describe what IS in the frame. NEVER write "without", "no", "avoid", "not", or any negative phrase. Only affirmative visual descriptions.
4. Keep the core subjects. Do not add new characters, dialogue, or plot twists.
5. INTEGRATE THE CONTEXT: If the user selected "Epic & Grand" vibe, the description should FEEL epic. If they chose "Solo Hero" cast, feature one protagonist. If the platform is TikTok vertical, think fast-paced vertical framing. Absorb every piece of context into the visual language.
6. LENGTH — CRITICAL: Your output MUST be between 500 and 650 characters. This is the sweet spot — rich enough to be cinematic, short enough to fit the UI. Stop at 650. Do not pad or repeat to reach 500; quality over quantity.
7. Output Format: Return ONLY the enhanced text. No intro, no explanation, no quotes.`;

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
        temperature: 0.72,
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
    const HARD_CAP = 650;
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
