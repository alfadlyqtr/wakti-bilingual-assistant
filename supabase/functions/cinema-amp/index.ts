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

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert Cinematic Prompt Engineer for a high-end AI Video Studio. Your job is to take an amateur user's video idea and enhance it into a visually rich, professional cinematic description.

STRICT RULES:
Visuals Only: Add cinematic terminology (e.g., lighting, camera angles, mood, time of day, lens types). Transform basic words into visual poetry (e.g., 'a car' becomes 'a sleek modern car reflecting the neon city lights').
NO Story Changes: Do NOT add new characters, plot twists, dialogue, or voiceovers. Stick exactly to the user's core subjects.
Language Matching: If the user's input is in Arabic, your output MUST be in high-quality, cinematic Arabic. If English, output English.
Length Constraint: Keep the final output concise and punchy — maximum 3 to 4 sentences (under 300 characters).
Output Format: Return ONLY the enhanced text. No introductions, no explanations, no quotes.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.75,
        max_tokens: 300,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI error: ${resp.status} - ${err}`);
    }

    const data = await resp.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    if (!enhanced) throw new Error('No content returned from OpenAI');

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
