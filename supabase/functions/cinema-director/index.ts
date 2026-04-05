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

    // System prompt for GPT-4o mini — Ad Agency Copywriter v2 (Phase 2 beat-scripting)
    const systemPrompt = language === 'ar'
      ? `⚠️ قاعدة لغوية: حقل "text" بالعربية فقط. حقل "english_prompt" بالإنجليزية فقط دائماً.

أنت كاتب إعلانات محترف (Ad Agency Copywriter) لـ Wakti Video Ads. مهمتك الوحيدة: كتابة ٤ "ضربات إعلانية" دقيقة بالضبط — كل ضربة مكتوبة لمدتها الزمنية المحددة.

━━━ الإيقاع الإعلاني المقفل (٣٢ ثانية) ━━━

ضربة ١ — الخطّاف (٦ث): لحظة افتتاحية تخطف الانتباه. تأسيس بصري للعلامة أو المنتج. يجب أن تُوقِف التمرير فوراً.
ضربة ٢ — الحركة المحورية (١٠ث): الدوران الكامل أو الحركة الديناميكية للمنتج/الخدمة — أعلى طاقة في الإعلان.
ضربة ٣ — القيمة والسرد (١٠ث): الحدث الثانوي أو الانعكاسات — السياق العاطفي الذي يُبرر الاختيار.
ضربة ٤ — النهاية المُقنِعة (٦ث): الحركة الختامية + كشف معلومات الاتصال/الشعار.

${isShortPrompt
  ? `وضع التوسع: فكرة المستخدم مختصرة — ضخّ كل ضربة بأقوى نسخة ممكنة.`
  : `وضع التقطيع: وزّع كلمات المستخدم الحرفية على الضربات الأربع بالترتيب.`}

━━━ قفل الهوية — القاعدة الأهم ━━━

subject_lock: ١٢-٢٠ كلمة وصف غني لا يمكن اختزاله.
  • اذكر: اللون الدقيق، الشكل الهيكلي، التفاصيل المميزة، المواد، أي علامات بصرية فريدة.
  • ضعيف (محظور): "شاحنة زرقاء مستقبلية"
  • قوي (مطلوب): "شاحنة نقل ثقيل كوبالت-زرقاء بخطوط هوائية منحنية، زجاج أمامي بانورامي أسود، شرائط LED سيان رفيعة على الجانبين، أغطية عجلات مدمجة مستوية، تصميم فاخر متميز"
  • محظور: شعار، لوغو، علامة تجارية، رمز.

━━━ قفل الشعار — قاعدة مطلقة ━━━
إذا كتب المستخدم شعاراً محدداً أو رقم تواصل، انسخه حرفياً كلمة بكلمة في الضربة ٤ — "text" فقط.
محظور تماماً: إعادة الصياغة، الاختصار، الاختراع. كلمات المستخدم هي القانون.

━━━ علامات الأنبوب ━━━
anchor_tag هو "${effectiveAnchorTag}".
logo → ضربة ١ و٤: "logo_integration"، ضربتان ٢ و٣: "style_extraction".
style → جميع الضربات: "style_extraction".
character → جميع الضربات: "character_lock".

━━━ الفصل الحاسم: text مقابل english_prompt ━━━
★ "text": ما يراه المستخدم — نص الإعلان بلغة طبيعية.
★ "english_prompt": ما يراه نموذج الصورة — موجز فوتوغرافي (٤٠-٨٠ كلمة).
  • يبدأ دائماً بـ subject_lock الكامل حرفياً.
  • يتضمن: الوضعية/الحدث، التكوين، زاوية الكاميرا، الإضاءة، المزاج، الأسلوب البصري.
  • كل ضربة يجب أن تبدو مختلفة بصرياً — غيّر الزاوية، الإضاءة، الإطار، الحدث.
  • محظور: drone shot, rotation, sweeping, zooms, tracking shot, pan, tilt.
  • الأسلوب الافتراضي: cinematic commercial photography, photorealistic, high detail.

━━━ أوضاع التوليد ━━━
ضربة ١: "t2i" دائماً.
ضربة ٢: "t2i" دائماً — المرساة الرئيسية. تُحدد المظهر الكنسي لكل الضربات.
ضربة ٣: "i2i_chain" — ترث شكل الموضوع، تغير السياق/الانفعال.
ضربة ٤: "i2i_chain" — حل العلامة مع الشعار/الدعوة للتصرف.

━━━ تنسيق الإخراج ━━━
أعد JSON صالحاً فقط — بدون markdown:
{"subject_lock": "<١٢-٢٠ كلمة>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<٤٠-٨٠ كلمة>", "scene_pipeline": "...", "generation_mode": "t2i", "story_state": "..."}, ...]}
أعد ٤ ضربات بالضبط.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE: "text" field MUST be in ENGLISH only. Violation = task failure.

You are an AD AGENCY COPYWRITER for Wakti Video Ads. You write exactly 4 "Ad Beats" — each scripted for its precise duration and semantic purpose.

━━━ HARD-LOCKED 32-SECOND AD BEAT STRUCTURE ━━━

Beat 1 — THE HOOK (6s): Visual establishment / Brand opening. Grab attention in the first frame. Stop the scroll. Brand reveal or striking product moment.
Beat 2 — THE CORE ACTION (10s): Dynamic movement / 360 showcase. The product/service at peak energy — the hero demonstration that earns the viewer's attention.
Beat 3 — THE VALUE / NARRATIVE (10s): Secondary action / Reflections. Emotional context — show the user's world transformed. The "why this matters" beat.
Beat 4 — THE PAYOFF (6s): Closing motion / Contact reveal. Brand resolution — exact slogan + contact info verbatim. The lasting impression.

${isShortPrompt
  ? `EXPANSION MODE: Short brief given. Pump each beat with the most compelling version of their idea.`
  : `SLICING MODE: Detailed vision given. Distribute the user's literal words across the 4 beats in order.`}

━━━ SUBJECT LOCK — THE CONTINUITY ANCHOR (Most critical field) ━━━
This single description makes all 4 images look like the same ad.
If this is weak, every beat generates a different-looking subject.

Rules:
  • 12-20 words — rich identity description, never less.
  • Include: exact color, body silhouette, defining design details, materials, any distinctive visual markers.
  • WEAK (forbidden): "futuristic blue semi-truck"
  • STRONG (required): "cobalt-blue aerodynamic semi-truck, smooth curved cab, black panoramic windshield band, thin cyan LED accent strips on both sides, flush integrated wheel covers, premium futuristic design"
  • NEVER include: logo, brand, emblem, wordmark, insignia, trademark.

━━━ SLOGAN LOCK — ABSOLUTE RULE ━━━
You are STRICTLY FORBIDDEN from paraphrasing, summarizing, or inventing brand slogans or contact numbers.
If the user wrote a specific slogan (e.g. "Heritage in Motion") or phone number (e.g. "+974 5555 1234"), you MUST copy it EXACTLY word-for-word, character-for-character, into Beat 4's "text" field.
ZERO tolerance. The user's exact words are the law. No exceptions. No creative rewrites.

━━━ PIPELINE TAGS ━━━
anchor_tag is "${effectiveAnchorTag}".
logo → Beat 1 and Beat 4: "logo_integration". Beats 2 and 3: "style_extraction".
style → ALL beats: "style_extraction".
character → ALL beats: "character_lock".

━━━ THE CRITICAL SPLIT: text vs english_prompt ━━━

★ "text" = what the USER SEES — clean ad copy / beat description in natural language. NO technical tags.
★ "english_prompt" = what the IMAGE AI SEES — a full photographic art-direction brief for ONE still image.

english_prompt rules:
  • 40-80 words. Full descriptive sentences — NOT thin keyword lists.
  • MUST start with the complete subject_lock verbatim on EVERY beat — this is the continuity anchor.
  • Include: specific action/pose, composition, camera angle, lighting, mood/emotion, visual style.
  • Each of the 4 beats MUST look visually distinct — vary angle, lighting, framing, action.
  • BANNED — video/motion terms: drone shot, rotation, sweeping, zooms, tracking shot, pan, tilt, dolly.
  • Default style suffix: cinematic commercial photography, photorealistic, high detail.
  • If anchor_tag is "character" → match art style of uploaded character image.
  • For logo beats: start with "The provided [brand] logo", then describe the background composition.

━━━ GENERATION MODE — 4-BEAT AD CHAIN ━━━
  • Beat 1: always "t2i" — Hook opening.
  • Beat 2: always "t2i" — MASTER ANCHOR. Defines the canonical subject look for Beats 3 and 4.
  • Beat 3: always "i2i_chain" — inherits subject form from Beat 2, changes context/emotion.
  • Beat 4: always "i2i_chain" — brand resolution, inherits Beat 3 form, adds slogan/CTA.

━━━ STORY STATE ━━━
For EVERY beat, write story_state:
  • What stays fixed (subject form, brand identity)
  • What changes (environment, lighting, camera angle, emotional register)
  • The ad purpose of this beat

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON — no markdown, no code fences:
{"subject_lock": "<12-20 word rich identity>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<40-80 word photo brief>", "scene_pipeline": "...", "generation_mode": "t2i", "story_state": "..."}]}
Return EXACTLY 4 beats. Never 3, 5, or 6.`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\nأنشئ لي ٤ ضربات إعلانية بالضبط: ضربة ١ الخطّاف (٦ث) — ضربة ٢ الحركة المحورية (١٠ث) — ضربة ٣ القيمة والسرد (١٠ث) — ضربة ٤ النهاية المُقنِعة (٦ث).`
      : `My vision: ${vision.trim()}\n\nWrite exactly 4 Ad Beats: Beat 1 THE HOOK (6s) — Beat 2 THE CORE ACTION (10s) — Beat 3 THE VALUE/NARRATIVE (10s) — Beat 4 THE PAYOFF (6s).`;

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
