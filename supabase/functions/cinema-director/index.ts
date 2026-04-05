// supabase/functions/cinema-director/index.ts
// Wakti Video Ads Director - GPT-4o mini powered scene generation v19 (4-scene / 32s Ad format)

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
  generation_mode?: 't2i' | 'i2i_chain'; // t2i = fresh generation, i2i_chain = use previous scene image as anchor
  story_state?: string; // what must stay the same + what changes from previous scene
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

    const { vision, language = 'en', anchor_tag = '' } = await req.json();
    const N = 4; // Video Ads v5.0: hard-locked to 4 scenes (6s-10s-10s-6s)
    const effectiveAnchorTag = anchor_tag || 'style'; // 'logo' | 'style' | 'character'

    if (!vision || !vision.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vision is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect short prompts — strip ALL PRODUCTION BRIEF metadata to count only user's actual story words
    let userCoreText = vision;
    // If structured as PRODUCTION BRIEF + STORY VISION, extract only the STORY VISION part
    const storyVisionMatch = vision.match(/STORY VISION:\n([\s\S]*)/i);
    if (storyVisionMatch) {
      userCoreText = storyVisionMatch[1];
    } else {
      // Strip chip-generated metadata lines (Subject:, Vibe:, Setting:, etc.)
      userCoreText = userCoreText
        .replace(/^(Subject|Setting|Action|Vibe|Cast|Goal|Brand|Format|Character)[^.\n]*[.\n]\s*/gim, '')
        .replace(/Brand (asset|reference image) provided:[^.\n]*[.\n]\s*/gi, '')
        .replace(/Character reference image provided:[^.\n]*[.\n]\s*/gi, '')
        .replace(/Format:[^.\n]*[.\n]\s*/gi, '');
    }
    userCoreText = userCoreText.trim();
    const wordCount = userCoreText.split(/\s+/).filter(Boolean).length;
    const isShortPrompt = wordCount < 30;
    console.log(`[cinema-director] wordCount=${wordCount}, isShortPrompt=${isShortPrompt}, N=${N}, lang=${language}`);

    // System prompt for GPT-4o mini — Vision Slicer / Story Creator
    const systemPrompt = language === 'ar'
      ? `⚠️ قاعدة لغوية: حقل "text" بالعربية فقط. حقل "english_prompt" بالإنجليزية فقط دائماً.

أنت كاتب إعلانات محترف (Ad Agency Copywriter) لـ Wakti Video Ads. مهمتك الوحيدة: إنشاء إعلان فيديو احترافي من ٤ مشاهد بالضبط بإيقاع زمني محدد.

━━━ تنسيق الإعلان الثابت (غير قابل للتغيير) ━━━

مشهد ١ — الخطاف (٦ ثواني): افتتاحية قوية تخطف الانتباه — شعار العلامة أو لحظة جذب بصرية.
مشهد ٢ — الميزة الرئيسية (١٠ ثواني): أبرز ما يميز المنتج/الخدمة — تفاصيل عالية الجودة وحركة.
مشهد ٣ — القصة والفائدة (١٠ ثواني): سياق المستخدم — كيف يُغيّر هذا المنتج حياته.
مشهد ٤ — الختام (٦ ثواني): دعوة للتصرف + شعار العلامة + معلومات الاتصال إن وُجدت.

${isShortPrompt
  ? `وضع التوسع: المستخدم أعطاك فكرة مختصرة. قم بتوسيعها في إطار ايقاع الإعلان الأربعة المشاهد أعلاه.`
  : `وضع التقطيع: قسّم رؤية المستخدم على المشاهد الأربعة أعلاه بالترتيب الحرفي لكلماته.`}

━━━ القواعد العامة ━━━

١. قفل الهوية البصرية (subject_lock) — الأهم على الإطلاق
  • ١٢-٢٠ كلمة — وصف تفصيلي دقيق.
  • اذكر: اللون الدقيق، شكل الهيكل، التفاصيل المميزة، المواد، أي علامات بصرية مميزة.
  • لا تضمّن كلمات: شعار، لوغو، علامة تجارية.

٢. قفل الشعار — قاعدة مطلقة
إذا كتب المستخدم شعاراً محدداً أو رقم تواصل، انسخه حرفياً كلمة بكلمة في مشهد ٤. محظور تماماً إعادة الصياغة.

٣. علامات الأنبوب (scene_pipeline)
anchor_tag هو "${effectiveAnchorTag}".
إذا كان anchor_tag هو "logo": المشهد ١ والمشهد ٤ → "logo_integration". المشهدان ٢ و٣ → "style_extraction".
إذا كان anchor_tag هو "style": جميع المشاهد → "style_extraction".
إذا كان anchor_tag هو "character": جميع المشاهد → "character_lock".

٤. الفصل الحاسم: text مقابل english_prompt
★ حقل "text": وصف المشهد بلغة طبيعية للمستخدم.
★ حقل "english_prompt": موجز فوتوغرافي كامل (٤٠-٨٠ كلمة) لنموذج الصورة.
  • يبدأ دائماً بـ subject_lock الكامل.
  • يتضمن: البيئة، الإضاءة، زاوية الكاميرا، المزاج، الأسلوب البصري.
  • محظور: لغة حركة الكاميرا (drone, rotation, zooms, sweeping).
  • الأسلوب: cinematic commercial photography, photorealistic, high detail.

٥. تنسيق الإخراج
أعد JSON صالحاً فقط — بدون markdown:
{"subject_lock": "<١٢-٢٠ كلمة>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<٤٠-٨٠ كلمة>", "scene_pipeline": "...", "generation_mode": "t2i", "story_state": "..."}, ...]}
أعد ٤ مشاهد بالضبط.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE: "text" field MUST be in ENGLISH only. Violation = task failure.

You are an AD AGENCY COPYWRITER for Wakti Video Ads. You are STRICTLY LIMITED to exactly 4 scenes. No more, no fewer.

━━━ HARD-LOCKED AD FORMAT: 32-SECOND / 4-SCENE ━━━

Scene 1 — THE HOOK (6s): Grab attention instantly. Brand logo reveal, bold visual statement, or a striking product moment. This scene MUST stop the scroll.
Scene 2 — THE KEY FEATURE (10s): The hero demonstration. Show the product/service at its most compelling — high-action, sharp detail, peak quality. What makes it worth watching.
Scene 3 — THE NARRATIVE BENEFIT (10s): The emotional payoff. Show the user's life with this product/service — aspiration, transformation, real-world context.
Scene 4 — THE CLOSER (6s): Call-to-action + brand sign-off. MUST include the exact slogan/contact info as written by the user, word-for-word.

${isShortPrompt
  ? `EXPANSION MODE: The user gave a short brief. Fill each of the 4 beats above with the most compelling version of their idea.`
  : `SLICING MODE: The user gave a detailed vision. Distribute their literal words across the 4 beats in order.`}

━━━ UNIVERSAL RULES ━━━

2. SUBJECT LOCK — THE CONTINUITY ANCHOR (Most important field)
This is what makes all 4 images look like they belong to the same ad.
If this is weak, every scene generates a different-looking subject.

Rules:
  • 12-20 words — NOT 3-8. Must be a rich identity description.
  • Include: exact color, body shape, defining design details, materials, any distinctive visual markers.
  • WEAK (forbidden): "futuristic blue semi-truck"
  • STRONG (required): "cobalt-blue aerodynamic semi-truck, smooth curved cab, black panoramic windshield band, thin cyan LED accent strips on both sides, flush integrated wheel covers, premium futuristic design"
  • NEVER include: logo, brand, emblem, wordmark, insignia.

3. SLOGAN LOCK — ABSOLUTE RULE
You are STRICTLY FORBIDDEN from paraphrasing, summarizing, or inventing brand slogans or contact numbers.
If the user wrote a specific slogan (e.g. "Heritage in Motion") or phone number, you MUST copy it EXACTLY word-for-word into Scene 4's "text".
NEVER use generic fillers. The user's exact words are the law. No exceptions.

4. PIPELINE TAGS
anchor_tag is "${effectiveAnchorTag}".
If logo: Scene 1 and Scene 4 → "logo_integration". Scenes 2 and 3 → "style_extraction".
If style: ALL scenes → "style_extraction".
If character: ALL scenes → "character_lock".

5. THE CRITICAL SPLIT: text vs english_prompt

★ "text" = what the USER SEES — the ad copy / scene description in natural language.
★ "english_prompt" = what the IMAGE AI SEES — a detailed visual art-direction brief for ONE still image.

━━━ english_prompt RULES ━━━

  • 40-80 words. Write full descriptive sentences — NOT thin keyword lists.
  • MUST start with the full subject_lock value on EVERY scene — this is the continuity anchor.
  • Include: specific action/pose, composition, camera angle, lighting, mood/emotion, visual style.
  • Each of the 4 scenes MUST look visually distinct — vary angle, lighting, framing, action.
  • BANNED — video/camera motion terms: drone shot, rotation, sweeping, zooms, tracking shot, pan, tilt.
  • Default style: cinematic commercial photography, photorealistic, high detail.
  • If anchor_tag is "character" → match the art style of the uploaded character image.
  • For logo scenes: start with "The provided [brand name] logo", then describe the background.

6. GENERATION MODE — 4-SCENE AD CHAIN
  • Scene 1: always "t2i" (Hook — brand/logo opening)
  • Scene 2: always "t2i" — MASTER ANCHOR. Defines the canonical look for all following scenes.
  • Scene 3: always "i2i_chain" from Scene 2 — inherits subject form, changes context/emotion.
  • Scene 4: always "i2i_chain" from Scene 3 — brand resolution with slogan/CTA.
  EXCEPTION: If Scene 1 is a logo tableau with no product visible, Scene 2 remains "t2i" master anchor.

7. STORY STATE — WHAT STAYS, WHAT CHANGES
For EVERY scene, define the story_state field:
  • What remains fixed from the previous scene (subject form, branding, etc.)
  • What changes (environment, lighting, camera focus, emotional register)
  • What is the ad purpose of this beat

Example story_state values (automotive ad):
  Scene 1: "Brand hook — logo tableau, product silhouette in dramatic backlight. Sets premium tone."
  Scene 2: "Master anchor — full vehicle established in showroom, crisp white lighting, hero front angle. All following scenes inherit this exact vehicle form."
  Scene 3: "Same vehicle form inherited. Environment: open road at golden hour. Emotional register: freedom and aspiration."
  Scene 4: "Same vehicle, brand resolution. Slogan + contact info in scene text verbatim. Closing brand moment."

8. OUTPUT FORMAT
Return ONLY valid JSON — no markdown:
{"subject_lock": "<12-20 word rich identity description>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<40-80 word photo brief>", "scene_pipeline": "...", "generation_mode": "t2i", "story_state": "..."}]}
Return EXACTLY 4 scenes. Never return 3, 5, or 6.`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\nأنشئ لي ٤ مشاهد إعلانية بالضبط بإيقاع (٦ث هوك - ١٠ث ميزة - ١٠ث قصة - ٦ث اختتام).`
      : `My vision: ${vision.trim()}\n\nCreate exactly 4 ad scenes using the 6s Hook / 10s Feature / 10s Story / 6s Closer rhythm.`;

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
        temperature: isShortPrompt ? 0.6 : 0.3,
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
        generation_mode: s.generation_mode || (i < 2 ? 't2i' : 'i2i_chain'),
        story_state: s.story_state || '',
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
