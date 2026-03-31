// supabase/functions/cinema-director/index.ts
// Wakti Cinema Director - GPT-4o mini powered scene generation v15 (language lock)

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
  text: string;         // display text in user's language (Arabic or English)
  english_prompt: string; // always-English prompt for AI image generation
  scene_pipeline?: 'logo_integration' | 'style_extraction' | 'character_lock';
  subject_lock?: string; // locked subject description for consistency
}

interface DirectorResponse {
  success: boolean;
  scenes: Scene[];
  visualDna?: string;
  subject_lock?: string;
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

    const { vision, language = 'en', scene_count = 6, anchor_tag = '' } = await req.json();
    const N = Math.max(1, Math.min(6, Number(scene_count) || 6));
    const effectiveAnchorTag = anchor_tag || 'style'; // 'logo' | 'style' | 'character'

    if (!vision || !vision.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vision is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // System prompt for GPT-4o mini — Vision Slicer
    const systemPrompt = language === 'ar'
      ? `⚠️ قاعدة لغوية: حقل "text" بالعربية فقط. حقل "english_prompt" بالإنجليزية فقط دائماً.

أنت سالب الرؤية. مهمتك الوحيدة: خذ رؤية المستخدم وقسّمها بالتساوي إلى ${N} مشهد سينمائي (١٠ ثواني لكل مشهد).

━━━ القواعد ━━━

١. سلب الرؤية — محظور تماماً اختراع محتوى جديد
يجب أن يكون كل حقل "text" مأخوذاً حرفياً من كلمات المستخدم نفسها. لا تضيف شعارات جديدة، لا تخترع موضوعات جديدة، لا تختصر النص. قُسّم كلمات المستخدم فقط إلى فصول بصرية.
مثال: إذا قال المستخدم "شاحنة تمشي في الصحراء ثم تصل إلى المدينة ويظهر شعار ميركاب" وN=3، الناتج:
  • مشهد 1 text: "شاحنة تمشي في الصحراء"
  • مشهد 2 text: "تصل إلى المدينة"
  • مشهد 3 text: "يظهر شعار ميركاب"

٢. قفل الموضوع (subject_lock)
استخرج الموضوع المادي الأساسي. القواعد:
  • لا تضمّن كلمات: شعار، لوغو، علامة تجارية، wordmark.
  • اربط الألوان الدقيقة — ٣ إلى ٨ كلمات.

٣. قفل الشعار — قاعدة مطلقة
محظور تماماً إعادة صياغة أو اختراع شعارات العلامة التجارية.
إذا كتب المستخدم شعاراً محدداً (مثال: "تراث يتحرك")، انسخه حرفياً كلمة بكلمة في "text" للمشهد الأخير.
لا تستخدم عبارات عامة أبداً. كلمات المستخدم هي القانون. لا تُعيد صياغته.

٤. علامات الأنبوب (scene_pipeline)
anchor_tag هو "${effectiveAnchorTag}".
إذا كان anchor_tag هو "logo": المشهد ١ والمشهد ${N} → "logo_integration". باقي المشاهد → "style_extraction".
إذا كان anchor_tag هو "style": جميع المشاهد → "style_extraction".
إذا كان anchor_tag هو "character": جميع المشاهد → "character_lock".

٥. الفصل الحاسم: text مقابل english_prompt

★ حقل "text": ما يراه المستخدم — وصف المشهد بلغة طبيعية.
★ حقل "english_prompt": ما يراه نموذج الصورة — تركيب بصري ثابت لصورة فوتوغرافية.

قواعد english_prompt:
  • قصير: ١٥-٢٥ كلمة. كلمات مفتاحية مفصولة بفواصل فقط.
  • يبدأ بقيمة subject_lock في كل مشهد — هذا يضمن التسلسل البصري (continuity).
  • محظور تماماً: لغة حركة الكاميرا مثل: drone shot, 360-degree, close-up shot, zooms out, flying between, sweeping rotation, camera captures — هذه تعني للفيديو وليست للصورة.
  • بدلاً من لغة الحركة، اصف التركيبة البصرية الثابتة: زاوية الكاميرا، الإضاءة، البيئة، المزاج.
  • يجب أن يحتوي كل english_prompt على بيئة/موقع صريح من: outdoor, exterior, aerial view, open highway, desert road, city street, mountain road, port, warehouse exterior, rooftop, waterfront, open sky.

تحويل لغة الحركة إلى تركيبة ثابتة:
  drone shot flying between skyscrapers → futuristic blue truck on city boulevard, aerial perspective, glass towers both sides
  close-up shot of chrome wheels → futuristic blue truck, chrome wheels detail, wet asphalt surface, neon light reflections
  360-degree rotation captures skyline → futuristic blue truck on elevated overpass, panoramic city skyline, golden hour

لمشاهد الشعار: يبدأ بـ "The provided [brand] logo" ثم يصف المشهد.

٦. تنسيق الإخراج
أعد JSON صالحاً فقط — بدون markdown:
{"subject_lock": "<٣-٨ كلمات>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<١٥-٢٥ كلمة>", "scene_pipeline": "..."}, ...]}
أعد ${N} مشهداً بالضبط.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE: "text" field MUST be in ENGLISH only. Violation = task failure.

You are the Vision Slicer for Wakti AI Cinema. Your ONLY job is to take the User Vision and divide it into exactly ${N} cinematic 10-second scene${N > 1 ? 's' : ''}.

YOU ARE STRICTLY FORBIDDEN FROM:
• Adding new slogans, taglines, or closing text that the user did not write.
• Inventing new themes, story beats, or creative elements.
• Summarizing or paraphrasing the user's words.
• Adding any text that was not in the user's original input.

YOUR ONLY ALLOWED ACTION: Break the user's literal words into ${N} visual chapters in the order they were written.

━━━ RULES ━━━

1. WORD-FOR-WORD SLICING — CRITICAL
Every "text" field MUST be taken verbatim from the user's input. Do not add, invent, or summarize.
Example: If user says "truck drives through desert then arrives at city then Merkab logo appears" with N=3:
  • Scene 1 text: "truck drives through desert"
  • Scene 2 text: "arrives at city"
  • Scene 3 text: "Merkab logo appears"

2. SUBJECT LOCK
Extract the core physical subject (e.g., "striking blue Merkab semi-truck"). Rules:
  • NEVER include: logo, brand, emblem, wordmark, insignia.
  • Lock exact colors. Keep it 3-8 words.

3. SLOGAN LOCK — ABSOLUTE RULE
You are STRICTLY FORBIDDEN from paraphrasing, summarizing, or inventing brand slogans.
If the user wrote a specific slogan (e.g. "Heritage in Motion", "Together We Build"), you MUST copy it EXACTLY word-for-word into the final scene's "text".
NEVER use generic fillers like "Together we build" or "Moving forward" unless the user wrote those exact words.
The user's exact words are the law. No exceptions.

4. PIPELINE TAGS
anchor_tag is "${effectiveAnchorTag}".
If logo: Scene 1 and Scene ${N} → "logo_integration". Middle scenes → "style_extraction".
If style: ALL scenes → "style_extraction".
If character: ALL scenes → "character_lock".

5. THE CRITICAL SPLIT: text vs english_prompt

★ "text" field = what the USER SEES — the scene description in natural language.
★ "english_prompt" field = what the IMAGE AI SEES — a still-photo composition brief.

These are TWO DIFFERENT THINGS. The image AI is NOT a film director. It generates a single photograph. Treat it like briefing a photographer, not a cinematographer.

english_prompt RULES:
  • SHORT: 15–25 words max. Comma-separated keywords only.
  • MUST start with the subject_lock value on EVERY single scene — this is how visual continuity is maintained across all images.
  • BANNED WORDS — these describe VIDEO/CAMERA MOVEMENT, not photos. NEVER use them in english_prompt:
      drone shot, flying between, 360-degree, rotation, sweeping, zooms out, zooms in, close-up shot of, 
      camera captures, tracking shot, pan, tilt, dolly, orbiting, spinning, dynamic shot, slow motion
  • INSTEAD, describe the STILL COMPOSITION using: camera angle, subject position, environment, lighting, mood.
  • MANDATORY: include one explicit outdoor/location keyword: outdoor, exterior, aerial view, open highway, 
      desert road, city street, mountain road, port, warehouse exterior, rooftop, waterfront, open sky, countryside.

TRANSLATION EXAMPLES — how to convert scene text into image prompts:
  text: "drone shot flying between skyscrapers at sunset"
  english_prompt: "[subject_lock], city boulevard, glass skyscrapers both sides, aerial perspective, golden sunset, outdoor, 8k"

  text: "close-up shot of the truck’s chrome wheels reflecting neon lights on a wet highway"
  english_prompt: "[subject_lock], chrome wheels detail, wet asphalt reflection, neon city lights, night, low angle, outdoor, 8k"

  text: "sweeping 360-degree rotation captures the entire modern skyline"
  english_prompt: "[subject_lock], elevated highway overpass, panoramic city skyline all around, golden hour, wide angle, outdoor, 8k"

  For logo scenes: start with "The provided [brand name] logo", then describe the background scene.

6. OUTPUT FORMAT
Return ONLY valid JSON — no markdown:
{"subject_lock": "<3-8 words>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<15-25 keywords>", "scene_pipeline": "..."}, ...]}
Return exactly ${N} scenes.`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\nأنشئ لي ${N} مشهد سينمائي مدة كل منها ١٠ ثواني.`
      : `My vision: ${vision.trim()}\n\nCreate exactly ${N} cinematic 10-second scene${N > 1 ? 's' : ''} for me.`;

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
        temperature: 0.3,
        max_tokens: 3000,
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

    // Parse the JSON response — Director now returns {subject_lock, scenes:[...]}
    let scenes: Scene[];
    let subjectLock = '';
    
    try {
      // Strip markdown code fences if present
      const cleaned = aiContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      
      // Try object format first (new Production Contract format)
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          scenes = parsed.scenes;
          subjectLock = parsed.subject_lock || '';
        } else if (Array.isArray(parsed)) {
          scenes = parsed;
        } else {
          throw new Error('No scenes array found in object');
        }
      } else {
        // Fallback: try array match (legacy format)
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed)) {
            scenes = parsed;
          } else {
            throw new Error('Not an array');
          }
        } else {
          throw new Error('No JSON found');
        }
      }
    } catch (_parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid JSON from AI director');
    }

    if (!scenes || scenes.length < 1) {
      throw new Error(`AI director returned no scenes`);
    }

    const response: DirectorResponse = {
      success: true,
      visualDna: '',
      subject_lock: subjectLock,
      scenes: scenes.slice(0, N).map((s, i) => ({
        scene: s.scene || i + 1,
        text: s.text || '',
        english_prompt: s.english_prompt || s.text || '',
        scene_pipeline: s.scene_pipeline || 'style_extraction',
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
