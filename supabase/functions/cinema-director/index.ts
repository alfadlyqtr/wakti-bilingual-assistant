// supabase/functions/cinema-director/index.ts
// Wakti Cinema Director - GPT-4o mini powered scene generation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-natively-app',
};

interface Scene {
  scene: number;
  text: string;
}

interface DirectorResponse {
  success: boolean;
  scenes: Scene[];
  visualDna?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Trial check: Cinema is locked for 24-hour trial users ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_subscribed, admin_gifted, payment_method, next_billing_date, free_access_start_at')
      .eq('id', user.id)
      .single();

    if (profile) {
      const isPaid = profile.is_subscribed === true;
      const isGifted = profile.admin_gifted === true;
      const pm = profile.payment_method;
      const hasActivePaid = pm && pm !== 'manual' && profile.next_billing_date && new Date(profile.next_billing_date) > new Date();
      const isOn24hTrial = profile.free_access_start_at != null;
      if (!isPaid && !isGifted && !hasActivePaid && isOn24hTrial) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cinema is not available during the 24-hour trial.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { vision, language = 'en' } = await req.json();

    if (!vision || !vision.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vision is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // System prompt for GPT-4o mini
    const systemPrompt = language === 'ar'
      ? `أنت مخرج سينما الذكاء الاصطناعي في وكتي. مهمتك هي تحويل رؤية هاوية من جملة واحدة إلى قصة سينمائية متسقة مدة ٦٠ ثانية (٦ مشاهد، ١٠ ثواني لكل مشهد).

التعليمات الأساسية:
أنشئ بلوك البصمة البصرية: أولاً، استخرج الموضوع، المواد، الإضاءة، والأسلوب السينمائي (مثال: 'صقر ميكانيكي مطلي بالذهب، تشطيب معدني مصقول، عيون زفير، إضاءة غروب الوسيل ٤ مساءً باللون البرتقالي، عدسة ٣٥مم، ٨ك فوتوغرافي واقعي'). يجب إضافة هذا البلوك في بداية EVERY مشهد لتحقيق ١٠٠٪ تناسق.
اكتب قوس القصة: أنشئ ٦ مشاهد تشكل رواية متسعة ٦٠ ثانية (مقدمة، بناء، حركة، ذروة، حل، ختام).
المشهد ١ (المرساة): أنشئ هذا خصيصاً للصورة-إلى-صورة. يجب أن يكون لقطة ساكنة مهيبة.
المشاهد ٢-٦ (الاستمرارية): أنشئ هذه للصورة-إلى-صورة والصورة-إلى-فيديو. ركز على الحركة والفعل مع الحفاظ على 'البصمة البصرية' متطابقة.
تنسيق الإخراج: أعد فقط مصفوفة JSON: [{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}, ...].`
      : `You are the Wakti AI Cinema Director. Your mission is to turn a 1-sentence amateur vision into a consistent 60-second cinematic story (6 scenes, 10 seconds each).

CORE INSTRUCTIONS:
CREATE THE VISUAL DNA BLOCK: First, extract the subject, materials, lighting, and cinematic style (e.g., 'Gold-plated mechanical falcon, polished metallic finish, sapphire eyes, 4pm Lusail sunset orange lighting, 35mm lens, 8k photorealistic'). This block MUST be prepended to the start of EVERY scene prompt for 100% consistency.
WRITE THE STORY ARC: Generate 6 scenes that form a cohesive 60-second narrative (Introduction, Build-up, Action, Climax, Resolution, Finale).
SCENE 1 (THE ANCHOR): Create this specifically for Text-to-Image. It must be a majestic static shot.
SCENES 2-6 (THE SEQUEL): Create these for Image-to-Image and Image-to-Video. Focus on movement and action while keeping the 'Visual DNA' identical.
OUTPUT FORMAT: Return ONLY a JSON array: [{"scene": 1, "text": "..."}, {"scene": 2, "text": "..."}, ...].`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\nأنشئ لي ٦ مشاهد سينمائية مدة كل منها ١٠ ثواني.`
      : `My vision: ${vision.trim()}\n\nCreate 6 cinematic 10-second scenes for me.`;

    // Call GPT-4o mini via OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${errorText}`);
    }

    const openAIData = await openAIResponse.json();
    const aiContent = openAIData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse the JSON response - GPT returns a JSON array directly per the system prompt
    let scenes: Scene[];
    
    try {
      // Strip markdown code fences if present
      const cleaned = aiContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      
      // Try array match first (expected format per system prompt)
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          scenes = parsed;
        } else {
          throw new Error('Not an array');
        }
      } else {
        // Fallback: try parsing as object with scenes key
        const objMatch = cleaned.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(objMatch ? objMatch[0] : cleaned);
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          scenes = parsed.scenes;
        } else {
          throw new Error('No scenes array found');
        }
      }
    } catch (_parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid JSON from AI director');
    }

    if (!scenes || scenes.length < 6) {
      throw new Error(`AI director returned ${scenes?.length ?? 0} scenes, expected 6`);
    }

    const response: DirectorResponse = {
      success: true,
      visualDna: '',
      scenes: scenes.slice(0, 6).map((s, i) => ({
        scene: s.scene || i + 1,
        text: s.text || ''
      }))
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cinema-director] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        scenes: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
