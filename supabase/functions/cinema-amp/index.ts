// supabase/functions/cinema-amp/index.ts
// Wakti Cinema AMP ⚡️ — Cinematic Prompt Enhancer (Gemini Flash-Lite)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sanitizeUserInput, withUserInputGuard } from '../_shared/promptSafety.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
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
    const safeText = sanitizeUserInput(text, { maxLength: 1200, label: 'cinema idea' }).trim();
    const safeContext = context && typeof context === 'object'
      ? Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sanitizeUserInput(value, { maxLength: 300, label: key })]))
      : {};
    if (!safeText) {
      return new Response(JSON.stringify({ ok: false, error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context block from all selected movie setup fields
    const ctxParts: string[] = [];
    if (safeContext.sceneCount) ctxParts.push(`Requested scene count: ${safeContext.sceneCount}`);
    if (safeContext.vibe) ctxParts.push(`Vibe/Mood: ${safeContext.vibe}`);
    if (safeContext.characters) ctxParts.push(`Cast: ${safeContext.characters}`);
    if (safeContext.platform) ctxParts.push(`Platform: ${safeContext.platform}`);
    if (safeContext.cta) ctxParts.push(`Goal: ${safeContext.cta}`);
    if (safeContext.setting) ctxParts.push(`Setting: ${safeContext.setting}`);
    if (safeContext.action) ctxParts.push(`Action: ${safeContext.action}`);
    const contextBlock = ctxParts.length > 0
      ? `\n\nMOVIE SETUP CONTEXT (use this to tailor your enhancement):\n${ctxParts.join('\n')}`
      : '';

    const systemPrompt = withUserInputGuard(`You are Wakti Cinema AMP, an assistant that improves a user's creative video idea for AI production.

The user's idea is the source of truth. Make it clearer, more visual, and easier for the Director to understand, but do not replace the idea.

STRICT RULES:
1. Preserve the user's language exactly. English in = English out. Arabic in = Arabic out.
2. Preserve every requested subject, character, object, place, action, order, brand detail, visible text, and constraint.
3. Add only useful production detail: visual clarity, continuity, camera direction, lighting, movement, and scene relationships.
4. Do not remove, weaken, reinterpret, or contradict any user instruction.
5. Do not invent extra characters, plot twists, products, slogans, locations, or commercial claims.
6. Do not force an advertisement structure. Follow the type of idea the user actually gave.
7. If the idea is already clear, improve it lightly rather than rewriting it heavily.
8. Use the optional setup context only to clarify the user's idea, never to replace it.
9. Return only the enhanced idea. No introduction, explanation, labels, or quotation marks.`);

    const userMessage = safeText + contextBlock;

    const resp = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini error: ${resp.status} - ${err}`);
    }

    const data = await resp.json();
    const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts as Array<{ text?: string }>
      : [];
    let enhanced = parts.map((p) => p?.text || '').join('').trim();
    if (!enhanced) throw new Error('No content returned from Gemini');

    const HARD_CAP = 1200;
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
