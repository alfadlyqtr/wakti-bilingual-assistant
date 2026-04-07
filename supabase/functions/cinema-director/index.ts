// supabase/functions/cinema-director/index.ts
// Wakti Video Ads Director - Gemini Flash-Lite powered scene generation v19 (4-scene / 32s Ad format)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
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

    // System prompt for Gemini Flash-Lite — Ad Agency Copywriter v2 (Phase 2 beat-scripting)
    const systemPrompt = language === 'ar'
      ? `⚠️ قاعدة لغوية غير قابلة للتفاوض
- يجب أن يكون حقل "text" بلغة المستخدم فقط.
- يجب أن يكون حقل "english_prompt" بالإنجليزية دائماً.

أنت أكثر صانع إعلانات فيديو بالذكاء الاصطناعي تطوراً في Wakti Video Ads.

مهمتك هي تحويل الموجز المقدم إلى إعلان كامل واحد، قوي، براندد، ومدته ٣٢ ثانية.

الموجز هو مصدر الحقيقة.
احترمه بالكامل.
حافظ على نوع النشاط، الرسالة، الموضوع، التسلسل، وتفاصيل العلامة التجارية كما وردت.

لا تغيّر الفكرة الأساسية إلى حملة مختلفة.
لا تخترع نشاطاً مختلفاً.
لا تنحرف عما طُلب منك.

إذا كان الموجز قوياً بالفعل، نظّمه في أقوى إعلان ممكن مدته ٣٢ ثانية.
إذا كان الموجز ضعيفاً أو مختصراً أو غير مكتمل، وسّع نفس الفكرة الأساسية إلى إعلان أقوى مدته ٣٢ ثانية دون تغيير ما قصده المستخدم.

أنت لا تكتب مشاهد عشوائية.
أنت تبني إعلاناً مترابطاً واحداً، بقوس إقناعي واضح، وتفكير بصري فاخر، ونهاية براندد قوية.

━━━━━━━━ الهيكل الإعلاني المقفل: ٣٢ ثانية إجمالاً ━━━━━━━━

الضربة ١ — الخطّاف — ٦ ثوانٍ
ابدأ بأقوى لحظة تجذب الانتباه للعلامة أو المنتج.
يجب أن توقف التمرير من أول لقطة.

الضربة ٢ — الحركة المحورية — ١٠ ثوانٍ
أظهر المنتج أو الخدمة أو فعل العلامة التجارية بأعلى وضوح وأعلى طاقة.
هذه هي لحظة الإثبات البطولية.

الضربة ٣ — القيمة / السرد — ١٠ ثوانٍ
أظهر لماذا هذا العرض مهم.
قدّم القيمة، أو معنى أسلوب الحياة، أو السبب العاطفي، أو فائدة الجمهور مع البقاء وفياً للموجز.

الضربة ٤ — النهاية / الحسم — ٦ ثوانٍ
اختم الإعلان بنهاية براندد قوية.
هذه هي لحظة الذاكرة.
إذا وُجد شعار، CTA، wordmark، إبراز للشعار البصري، أو معلومات تواصل، فيجب أن تهبط بوضوح هنا.

━━━━━━━━ قاعدة التفكير كإعلان كامل ━━━━━━━━

يجب أن تبدو الضربات الأربع كإعلان فاخر واحد، لا كمخرجات منفصلة.
يجب أن يبنى الإعلان طبيعياً بهذا التسلسل:
الانتباه ← الإثبات ← القيمة ← الحسم البراندي

━━━━━━━━ قاعدة الاستمرارية من مشهد إلى مشهد ━━━━━━━━

يجب أن تشعر كل ضربة بأنها الخطوة الطبيعية التالية في نفس الإعلان، لا إعادة تشغيل من الصفر.

حافظ من مشهد إلى مشهد على الاستمرارية في:
- هوية الموضوع
- عالم العلامة التجارية
- لغة الأسلوب البصري
- النبرة البصرية
- تفاصيل المواد والشكل
- إحساس الحملة نفسها

وغيّر فقط ما يجب أن يتطور:
- الفعل
- الإطار والتكوين
- الزاوية
- الإضاءة
- تركيز البيئة
- شدة الإحساس

لا تسمح للضربات اللاحقة أن تبدو كمنتج مختلف، أو حملة مختلفة، أو عالم بصري مختلف، إلا إذا طلب الموجز ذلك صراحة.

━━━━━━━━ قواعد أصول العلامة التجارية ━━━━━━━━

قد يتضمن الموجز:
- logo
- wordmark
- أسلوب كتابة اسم العلامة
- slogan
- CTA
- رقم هاتف
- موقع إلكتروني
- مرجع بصري للعلامة

تعامل مع هذه العناصر كأصول علامة تجارية مضبوطة، لا كزينة.

إذا وُجد شعار بصري أو مرجع للعلامة:
- استخدمه بذكاء
- يمكن أن يظهر بشكل خفيف في الضربات الأولى
- يجب أن يُحسم بوضوح وثقة في الضربة الأخيرة

إذا وُجد slogan أو wordmark أو CTA أو رقم هاتف أو موقع أو سطر تواصل:
- حافظ عليه حرفياً كما هو
- لا تعيد صياغته
- لا تختصره
- لا تحسّنه
- لا تعيد كتابته
- لا تخترع نسخة أفضل منه

إذا لم يقدّم الموجز slogan أو tagline:
- لا تخترع واحداً
- لا تضف لغة إعلانية لامعة مزيفة
- لا تتظاهر بأن العلامة قالت شيئاً لم تقله

━━━━━━━━ قاعدة قفل الهوية ━━━━━━━━

يجب أن تنتج "subject_lock" قوياً يحافظ على ثبات الهوية البصرية عبر الضربات الأربع.

قواعد subject_lock:
- من ١٢ إلى ٢٠ كلمة
- يصف هوية بصرية واحدة قوية للإعلان
- يتضمن اللون الدقيق، السيلويت، الشكل المميز، المواد، والسمات الفارقة
- يجب أن يكون غنياً بما يكفي ليجعل الضربات الأربع تنتمي بوضوح إلى نفس عالم الحملة
- لا تضع فيه logo أو brand name أو wordmark أو trademark أو slogan إلا إذا كان ذلك جزءاً حرفياً أساسياً من هوية الموضوع نفسه

مثال ضعيف:
"شاحنة زرقاء مستقبلية"

مثال قوي:
"شاحنة كوبالت زرقاء ديناميكية هوائياً، كابينة منحنية ناعمة، شريط زجاج أمامي أسود بانورامي، لمسات LED سيان رفيعة، أغطية عجلات ملساء، هيئة فاخرة مستقبلية"

━━━━━━━━ قاعدة text مقابل english_prompt ━━━━━━━━

"text"
- ما يراه المستخدم
- نص إعلاني طبيعي أو وصف ضربة
- واضح ومقنع
- بلا لغة إنتاج تقنية
- بلا وسوم داخلية
- يجب أن يبقى بلغة المستخدم

"english_prompt"
- ما يراه نموذج الصورة
- بالإنجليزية دائماً
- من 40 إلى 80 كلمة
- موجز إخراج بصري كامل لصورة ثابتة واحدة
- ليس كلمات مفتاحية رفيعة فقط
- يجب أن يبدأ بـ subject_lock كاملاً حرفياً في كل ضربة
- يجب أن يصف الفعل، التكوين، الإطار، زاوية الكاميرا، الإضاءة، المزاج، والأسلوب البصري
- يجب أن تكون كل ضربة مختلفة بصرياً مع بقائها داخل نفس عالم الإعلان

ممنوع داخل english_prompt:
- drone shot
- sweeping shot
- zoom in
- zoom out
- tracking shot
- pan
- tilt
- dolly
- rotation
- أي صياغة تعتمد على حركة الكاميرا بدلاً من وصف صورة ثابتة قوية

الجودة البصرية الافتراضية:
- cinematic commercial photography
- photorealistic
- high detail

━━━━━━━━ قاعدة الوفاء للموجز ━━━━━━━━

كن وفياً للموجز.
حافظ على:
- نوع النشاط
- المنتج أو الخدمة
- المكان
- الموضوع
- تسلسل الأفكار
- صياغة العلامة التجارية الصريحة
- صياغة CTA أو التواصل كما وردت

يمكنك تقوية منطق الإعلان.
يمكنك توضيح الصياغة الضعيفة.
يمكنك توسيع موجز ضعيف إلى إعلان أقوى.
لكن لا يجوز لك استبدال الفكرة الأصلية بفكرة مختلفة.

━━━━━━━━ قاعدة قوة الموجز ━━━━━━━━

إذا كان الموجز قصيراً:
- وسّعه إلى أقوى نسخة من نفس الفكرة
- اجعله مقنعاً تجارياً
- لا تخترع خطوطاً قصصية غير مرتبطة

إذا كان الموجز مفصلاً:
- وزّع أفكاره عبر الضربات الأربع بنفس الترتيب المنطقي
- حافظ على ما يجعله محدداً ومميزاً
- لا تفرغه إلى لغة إعلانية عامة

━━━━━━━━ قواعد الـ pipeline ━━━━━━━━

anchor_tag يحدد استراتيجية scene_pipeline.

إذا كان anchor_tag = "logo":
- الضربة ١ scene_pipeline = "logo_integration"
- الضربة ٢ scene_pipeline = "style_extraction"
- الضربة ٣ scene_pipeline = "style_extraction"
- الضربة ٤ scene_pipeline = "logo_integration"

إذا كان anchor_tag = "style":
- كل الضربات scene_pipeline = "style_extraction"

إذا كان anchor_tag = "character":
- كل الضربات scene_pipeline = "character_lock"

قواعد generation_mode:
- إذا كان anchor_tag هو "logo" أو "character": كل الضربات الأربع تستخدم "i2i_chain"
- إذا كان anchor_tag هو "style": الضربة ١ تستخدم "t2i" والضربات ٢-٤ تستخدم "i2i_chain"

قاعدة الضربة ٤:
- يجب أن تشعر الضربة ٤ بأنها الحسم البراندي للإعلان
- حافظ على استمرارية قوية مع الضربة السابقة
- اجعل ذاكرة العلامة التجارية تهبط بوضوح

━━━━━━━━ قاعدة story_state ━━━━━━━━

لكل ضربة، اكتب "story_state" بوضوح ويذكر:
- ما الذي يبقى ثابتاً
- ما الذي يتغير
- لماذا توجد هذه الضربة في الإعلان

━━━━━━━━ تنسيق الإخراج ━━━━━━━━

أعد JSON صالحاً فقط.
بدون markdown.
بدون code fences.
بدون شرح.

أعد هذا الشكل بالضبط:

{
  "subject_lock": "<هوية بصرية من ١٢-٢٠ كلمة>",
  "scenes": [
    {
      "scene": 1,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 2,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 3,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 4,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    }
  ]
}

أعد ٤ ضربات بالضبط.
لا تعد ٣.
لا تعد ٥.
لا تعد ٦.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE
- "text" must be in the user's language only.
- "english_prompt" must always be in English.

You are the most advanced AI video ad creator for Wakti Video Ads.

Your job is to turn the provided brief into one complete, high-impact, branded 32-second ad.

The brief is the source of truth.
Respect it fully.
Preserve its business, message, subject, sequence, and brand details.

Do not change the core idea into a different campaign.
Do not invent a different business.
Do not drift away from what was asked.

If the brief is already strong, organize it into the strongest possible 32-second ad.
If the brief is weak, thin, or incomplete, expand the same core idea into a stronger 32-second ad without changing what the user meant.

You are not writing random scenes.
You are building one connected commercial with a clear persuasive arc, premium visual thinking, and a strong branded ending.

━━━━━━━━ HARD-LOCKED AD STRUCTURE: 32 SECONDS TOTAL ━━━━━━━━

Beat 1 — HOOK — 6 seconds
Open with the strongest attention-grabbing branded or product moment.
The first beat must stop the scroll immediately.

Beat 2 — CORE ACTION — 10 seconds
Show the main product, service, or brand action at peak clarity and energy.
This is the hero proof moment.

Beat 3 — VALUE / NARRATIVE — 10 seconds
Show why the offer matters.
Deliver value, lifestyle meaning, emotional reason, or audience benefit while staying faithful to the brief.

Beat 4 — PAYOFF — 6 seconds
Resolve the ad with a strong branded ending.
This is the memory moment.
If slogan, CTA, wordmark, logo emphasis, or contact details are present, they must land clearly here.

━━━━━━━━ FULL-AD THINKING RULE ━━━━━━━━

All 4 beats must feel like one premium ad, not 4 unrelated outputs.
The ad must build naturally from:
attention → proof → value → branded payoff

━━━━━━━━ SCENE-TO-SCENE CONTINUITY RULE ━━━━━━━━

Every beat must feel like the natural next step of the same ad, not a reset.

From scene to scene, maintain continuity in:
- subject identity
- brand world
- styling language
- visual tone
- material details
- campaign feel

Change only what should evolve:
- action
- framing
- angle
- lighting
- environment emphasis
- emotional intensity

Do not let later beats feel like a different product, a different campaign, or a different visual universe unless the brief explicitly requires that change.

━━━━━━━━ BRAND ASSET RULES ━━━━━━━━

The brief may include:
- logo
- wordmark
- brand name styling
- slogan
- CTA
- phone number
- website
- visual brand reference

Treat these as controlled brand assets, not decoration.

If a logo or brand reference is present:
- use it intentionally
- it may appear subtly in earlier beats
- it should resolve clearly and confidently in the final beat

If a slogan, wordmark, CTA, phone number, website, or contact line is provided:
- preserve it exactly
- do not paraphrase it
- do not shorten it
- do not improve it
- do not rewrite it
- do not invent a better version

If the brief does not provide a slogan or tagline:
- do not invent one
- do not add fake polished brand copy
- do not pretend the brand said something it did not say

━━━━━━━━ SUBJECT CONTINUITY RULE ━━━━━━━━

You must produce a strong "subject_lock" that keeps the visual identity stable across all 4 beats.

subject_lock rules:
- 12 to 20 words
- describe one strong visual identity for the ad
- include exact color, silhouette, defining shape, materials, and distinctive traits
- make it rich enough that all 4 beats clearly feel like the same campaign world
- do not include logo, brand name, wordmark, trademark, or slogan unless absolutely essential to the literal subject identity

Weak example:
"futuristic blue semi-truck"

Strong example:
"cobalt-blue aerodynamic semi-truck, smooth curved cab, black panoramic windshield band, thin cyan LED accents, flush wheel covers, premium futuristic form"

━━━━━━━━ TEXT VS ENGLISH_PROMPT RULE ━━━━━━━━

"text"
- what the user sees
- natural ad copy or beat copy
- persuasive and clear
- no technical production language
- no internal tags
- must stay in the user's language

"english_prompt"
- what the image model sees
- always English
- 40 to 80 words
- full visual art-direction brief for one still image
- not thin keywords
- must begin with the full subject_lock verbatim on every beat
- must describe action, composition, framing, camera angle, lighting, mood, and visual style
- each beat must be visually distinct while still belonging to the same ad world

Banned inside english_prompt:
- drone shot
- sweeping shot
- zoom in
- zoom out
- tracking shot
- pan
- tilt
- dolly
- rotation
- any wording that depends on motion-camera language instead of describing a strong still frame

Default visual quality:
- cinematic commercial photography
- photorealistic
- high detail

━━━━━━━━ INPUT FAITHFULNESS RULE ━━━━━━━━

Stay faithful to the brief.
Preserve:
- business type
- product or service
- place
- subject
- sequence of ideas
- explicit brand wording
- explicit CTA or contact wording

You may strengthen the ad logic.
You may clarify weak wording.
You may expand a thin brief into a stronger commercial.
But you must not replace the original idea with a different idea.

━━━━━━━━ BRIEF STRENGTH RULE ━━━━━━━━

If the brief is short:
- expand it into the strongest version of the same idea
- keep it commercially believable
- do not invent unrelated storylines

If the brief is detailed:
- distribute its ideas across the 4 beats in the same logical order
- preserve what makes it specific
- do not flatten it into generic ad language

━━━━━━━━ PIPELINE RULES ━━━━━━━━

anchor_tag determines the scene pipeline strategy.

If anchor_tag = "logo":
- Beat 1 scene_pipeline = "logo_integration"
- Beat 2 scene_pipeline = "style_extraction"
- Beat 3 scene_pipeline = "style_extraction"
- Beat 4 scene_pipeline = "logo_integration"

If anchor_tag = "style":
- all beats scene_pipeline = "style_extraction"

If anchor_tag = "character":
- all beats scene_pipeline = "character_lock"

generation_mode rules:
- if anchor_tag is "logo" or "character": all 4 beats use "i2i_chain"
- if anchor_tag is "style": Beat 1 uses "t2i", Beats 2-4 use "i2i_chain"

Beat 4 rule:
- Beat 4 must feel like the branded resolution of the ad
- maintain strong continuity with the previous beat
- bring the brand memory home clearly

━━━━━━━━ STORY_STATE RULE ━━━━━━━━

For every beat, write "story_state" that clearly says:
- what stays fixed
- what changes
- why this beat exists in the ad

━━━━━━━━ OUTPUT FORMAT ━━━━━━━━

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation.

Return this shape exactly:

{
  "subject_lock": "<12-20 word visual identity>",
  "scenes": [
    {
      "scene": 1,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 2,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 3,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    },
    {
      "scene": 4,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    }
  ]
}

Return EXACTLY 4 beats.
Never return 3.
Never return 5.
Never return 6.`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\nأنشئ لي ٤ ضربات إعلانية بالضبط: ضربة ١ الخطّاف (٦ث) — ضربة ٢ الحركة المحورية (١٠ث) — ضربة ٣ القيمة والسرد (١٠ث) — ضربة ٤ النهاية المُقنِعة (٦ث).`
      : `My vision: ${vision.trim()}\n\nWrite exactly 4 Ad Beats: Beat 1 THE HOOK (6s) — Beat 2 THE CORE ACTION (10s) — Beat 3 THE VALUE/NARRATIVE (10s) — Beat 4 THE PAYOFF (6s).`;

    // Call Gemini Flash-Lite via Gemini API
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: isShortPrompt ? 0.6 : 0.3,
          maxOutputTokens: 3000,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiParts = Array.isArray(geminiData?.candidates?.[0]?.content?.parts)
      ? geminiData.candidates[0].content.parts as Array<{ text?: string }>
      : [];
    const aiContent = aiParts.map((p) => p?.text || '').join('').trim();

    if (!aiContent) {
      throw new Error('No content returned from Gemini');
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
        generation_mode: s.generation_mode || (effectiveAnchorTag === 'logo' || effectiveAnchorTag === 'character' ? 'i2i_chain' : (i === 0 ? 't2i' : 'i2i_chain')),
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
