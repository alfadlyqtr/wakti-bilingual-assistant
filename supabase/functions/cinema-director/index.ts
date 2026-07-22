// supabase/functions/cinema-director/index.ts
// Wakti Cinema Director - Gemini Flash-Lite powered connected video scene generation with an AI-selected 3–8 scene count

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { inspectGenerationPrompt } from '../_shared/promptSafety.ts';
import { isTrialTimerActive, type TrialProfileShape } from '../_shared/trial-tracker.ts';

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

function containsArabic(value: string): boolean {
  return /[\u0600-\u06FF]/u.test(value);
}

async function repairArabicSceneTexts(scenes: Scene[]): Promise<Scene[]> {
  if (scenes.every((scene) => containsArabic(scene.text))) return scenes;

  const repairResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: 'Rewrite each scene description in clear, natural Arabic only. Preserve the exact subject, action, order, objects, and meaning. Return only a JSON array of strings in the same order. Do not include English, Spanish, explanations, or markdown.',
        }],
      },
      contents: [{
        role: 'user',
        parts: [{ text: JSON.stringify(scenes.map((scene) => scene.text)) }],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1800 },
    }),
  });

  if (!repairResponse.ok) throw new Error('Arabic scene language correction failed');
  const repairData = await repairResponse.json();
  const repairContent = Array.isArray(repairData?.candidates?.[0]?.content?.parts)
    ? repairData.candidates[0].content.parts.map((part: { text?: string }) => part?.text || '').join('').trim()
    : '';
  const cleaned = repairContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let repairedTexts: unknown;
  try {
    repairedTexts = JSON.parse(cleaned);
  } catch {
    throw new Error('Arabic scene language correction returned invalid data');
  }

  if (!Array.isArray(repairedTexts) || repairedTexts.length !== scenes.length || repairedTexts.some((text) => typeof text !== 'string' || !containsArabic(text))) {
    throw new Error('Arabic scene language correction returned invalid text');
  }

  return scenes.map((scene, index) => ({ ...scene, text: repairedTexts[index] as string }));
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
      const isOn24hTrial = isTrialTimerActive(profile as TrialProfileShape);
      if (!isPaid && !isGifted && !hasActivePaid && isOn24hTrial) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cinema is not available during the 24-hour trial.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { vision, language = 'en', anchor_tag = '', scene_count, seed } = await req.json();
    const MIN_SCENES = 3;
    const MAX_SCENES = 8;
    const parsedSceneCount = Number(scene_count);
    const requestedSceneCount = Number.isInteger(parsedSceneCount) && parsedSceneCount >= MIN_SCENES && parsedSceneCount <= MAX_SCENES
      ? parsedSceneCount
      : undefined;
    const effectiveAnchorTag = anchor_tag || 'style'; // 'logo' | 'product' | 'style' | 'character'

    if (!vision || !vision.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vision is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const promptSafety = inspectGenerationPrompt(vision, language);
    if (!promptSafety.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: promptSafety.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect short prompts — strip ALL PRODUCTION BRIEF metadata to count only user's actual story words
    let userCoreText = promptSafety.normalizedPrompt;
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
    console.log(`[cinema-director] wordCount=${wordCount}, isShortPrompt=${isShortPrompt}, sceneRange=${requestedSceneCount || `${MIN_SCENES}-${MAX_SCENES}`}, seed=${seed || 'auto'}, lang=${language}`);

    // System prompt for Gemini Flash-Lite — Ad Agency Copywriter v2 (Phase 2 beat-scripting)
    const systemPrompt = language === 'ar'
      ? `⚠️ قاعدة لغوية غير قابلة للتفاوض
- يجب أن يكون حقل "text" بلغة المستخدم فقط.
- يجب أن يكون حقل "english_prompt" بالإنجليزية دائماً.

أنت المخرج الإبداعي للفيديو في Wakti.

مهمتك تحويل الموجز إلى فيديو إبداعي واحد مترابط بعدد مشاهد يختاره المخرج. قد يكون الفيديو قصة، إعلاناً، عرضاً لمنتج، رحلة لشخصية، فيلماً للعلامة التجارية، أو أي تسلسل بصري آخر. استنتج الغرض من الموجز ولا تفرض عليه قالب إعلان إذا لم يطلبه المستخدم.

الموجز هو مصدر الحقيقة.
احترمه بالكامل.
حافظ على الفكرة، الموضوع، الشخصيات، المنتج، الرسالة، التسلسل، وتفاصيل العلامة التجارية كما وردت.

لا تغيّر الفكرة الأساسية.
لا تخترع نشاطاً مختلفاً.
لا تنحرف عما قصده المستخدم.

إذا كان الموجز مختصراً أو ناقصاً، وسّع نفس الفكرة إلى فيديو أقوى دون تغيير معناها.
أنت لا تكتب مشاهد عشوائية، بل تبني قوساً بصرياً واحداً مترابطاً له بداية وتطور ونهاية.

━━━━━━━━ هيكل الفيديو: عدد مشاهد مترابط يختاره المخرج ━━━━━━━━

المشهد ١ — التأسيس والخطّاف
قدّم أقوى بداية بصرية تناسب الفكرة. عرّف العالم والشخصية أو المنتج واجعل المشاهد يريد معرفة ما سيحدث.

المشهدان ٢ و٣ — التطور
طوّر الحدث أو الرحلة أو قيمة المنتج أو العلاقة بين الشخصيات بحسب الموجز. كل مشهد يجب أن يكون الخطوة الطبيعية التالية، لا إعادة بداية جديدة.

المشهد ٤ — التصاعد أو الإثبات
ارفع الرهان أو أظهر التحول أو الفائدة أو لحظة الاكتشاف التي تجعل النهاية مستحقة.

المشهد الأخير — الحسم
اختم القوس البصري بشكل طبيعي. إذا كان الفيديو إعلاناً وكان هناك شعار أو CTA أو معلومات تواصل، اجعلها تهبط بوضوح هنا. إذا كان قصة، قدّم نهاية قصصية مرضية دون اختراع رسالة تجارية.

━━━━━━━━ قاعدة التفكير كفيديو كامل ━━━━━━━━

يجب أن تبدو المشاهد المختارة كفيديو إبداعي واحد، لا كمخرجات منفصلة.
اتبع ترتيب الفكرة كما وردت في الموجز، واجعل كل مشهد يغيّر شيئاً مهماً مع الحفاظ على الاستمرارية.

━━━━━━━━ قاعدة الاستمرارية من مشهد إلى مشهد ━━━━━━━━

يجب أن تشعر كل مشهد بأنه الخطوة الطبيعية التالية في نفس الفيديو، لا إعادة تشغيل من الصفر.

حافظ من مشهد إلى مشهد على الاستمرارية في:
- هوية الموضوع
- عالم العلامة التجارية
- لغة الأسلوب البصري
- النبرة البصرية
- تفاصيل المواد والشكل
- إحساس الفيديو الإبداعي نفسه

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

يجب أن تنتج "subject_lock" قوياً يحافظ على ثبات الهوية البصرية عبر المشاهد المختارة.

قواعد subject_lock:
- من ١٢ إلى ٢٠ كلمة
- يصف هوية بصرية واحدة قوية للفيديو
- يتضمن اللون الدقيق، السيلويت، الشكل المميز، المواد، والسمات الفارقة
- يجب أن يكون غنياً بما يكفي ليجعل المشاهد المختارة تنتمي بوضوح إلى نفس العالم البصري
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
- وزّع أفكاره عبر المشاهد المختارة بنفس الترتيب المنطقي
- حافظ على ما يجعله محدداً ومميزاً
- لا تفرغه إلى لغة إعلانية عامة

━━━━━━━━ قواعد الـ pipeline ━━━━━━━━

anchor_tag يحدد استراتيجية scene_pipeline.

إذا كان anchor_tag = "logo":
- المشهد ١ scene_pipeline = "logo_integration"
- المشاهد ٢ و٣ و٤ scene_pipeline = "style_extraction"
- المشهد الأخير scene_pipeline = "logo_integration"

إذا كان anchor_tag = "style":
- كل المشاهد scene_pipeline = "style_extraction"

إذا كان anchor_tag = "character":
- كل المشاهد scene_pipeline = "character_lock"

قواعد generation_mode:
- إذا كان anchor_tag هو "logo" أو "character": كل المشاهد المختارة تستخدم "i2i_chain"
- إذا كان anchor_tag هو "style": المشهد ١ يستخدم "t2i" والمشاهد اللاحقة تستخدم "i2i_chain"

قاعدة المشهد الأخير:
- يجب أن يشعر المشهد الأخير بأنه الحسم الطبيعي للفيديو
- حافظ على استمرارية قوية مع المشهد السابق
- إذا كان الفيديو إعلاناً، اجعل ذاكرة العلامة التجارية تهبط بوضوح

━━━━━━━━ قاعدة story_state ━━━━━━━━

لكل مشهد، اكتب "story_state" بوضوح ويذكر:
- ما الذي يبقى ثابتاً
- ما الذي يتغير
- لماذا يوجد هذا المشهد في الفيديو

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
    },
    {
      "scene": 5,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    }
  ]
}

أعد فقط العدد الذي تحتاجه الفكرة، بين ٣ و٨ مشاهد.
لا تملأ المشاهد إلى عدد ثابت.
لا تعد أقل من ٣ مشاهد أو أكثر من ٨ مشاهد.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE
- "text" must be in the user's language only.
- "english_prompt" must always be in English.

You are Wakti's AI Creative Video Director.

Your job is to turn the provided brief into one complete, connected creative video using the number of scenes the idea needs. It may be a story, advertisement, product showcase, character journey, brand film, or another visual sequence. Infer the intended type from the brief and do not force an advertisement structure when one was not requested.

The brief is the source of truth.
Respect it fully.
Preserve its idea, subject, characters, product, message, sequence, and brand details.

Do not change the core idea.
Do not invent a different business or storyline.
Do not drift away from what the user meant.

If the brief is short or incomplete, expand the same idea into a stronger connected video without changing its meaning.
You are not writing random scenes. You are building one visual arc with a fitting beginning, development, and resolution.

━━━━━━━━ VIDEO STRUCTURE: A CONNECTED VIDEO WITH AN AI-SELECTED SCENE COUNT ━━━━━━━━

Scene 1 — OPENING AND HOOK
Begin with the strongest visual opening for the idea. Establish the world, character, product, or problem and create curiosity.

Scenes 2 and 3 — DEVELOPMENT
Develop the event, journey, product value, or relationship according to the brief. Each scene must be the natural next step, not a reset.

Scene 4 — ESCALATION OR PROOF
Raise the stakes, show the transformation, reveal the discovery, or demonstrate the benefit that makes the ending meaningful.

The final scene — RESOLUTION
Resolve the visual arc naturally. If the video is an advertisement and a logo, CTA, slogan, or contact detail was provided, land it clearly here. If it is a story, provide a satisfying story ending without inventing a commercial message.

━━━━━━━━ FULL-VIDEO THINKING RULE ━━━━━━━━

All selected scenes must feel like one connected creative video, not unrelated outputs.
Follow the idea's natural progression from the brief and make each scene change something important while preserving continuity.

━━━━━━━━ SCENE-TO-SCENE CONTINUITY RULE ━━━━━━━━

Every scene must feel like the natural next step of the same video, not a reset.

From scene to scene, maintain continuity in:
- subject identity
- brand world
- styling language
- visual tone
- material details
- overall visual world and creative feel

Change only what should evolve:
- action
- framing
- angle
- lighting
- environment emphasis
- emotional intensity

Do not let later scenes feel like a different subject, storyline, or visual universe unless the brief explicitly requires that change.

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
- it may appear subtly in earlier scenes
- it should resolve clearly and confidently in the final scene when relevant

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

You must produce a strong "subject_lock" that keeps the visual identity stable across all selected scenes.

subject_lock rules:
- 12 to 20 words
- describe one strong visual identity for the video
- include exact color, silhouette, defining shape, materials, and distinctive traits
- make it rich enough that all selected scenes clearly feel like the same visual world
- do not include logo, brand name, wordmark, trademark, or slogan unless absolutely essential to the literal subject identity

Weak example:
"futuristic blue semi-truck"

Strong example:
"cobalt-blue aerodynamic semi-truck, smooth curved cab, black panoramic windshield band, thin cyan LED accents, flush wheel covers, premium futuristic form"

━━━━━━━━ TEXT VS ENGLISH_PROMPT RULE ━━━━━━━━

"text"
- what the user sees
- natural user-facing copy or scene description
- clear and appropriate to the brief
- no technical production language
- no internal tags
- must stay in the user's language

"english_prompt"
- what the image model sees
- always English
- 40 to 80 words
- full visual art-direction brief for one still image
- not thin keywords
- must begin with the full subject_lock verbatim in every scene
- must describe action, composition, framing, camera angle, lighting, mood, and visual style
- each scene must be visually distinct while still belonging to the same creative world

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

You may strengthen the creative logic.
You may clarify weak wording.
You may expand a thin brief into a stronger connected video.
But you must not replace the original idea with a different idea.

━━━━━━━━ BRIEF STRENGTH RULE ━━━━━━━━

If the brief is short:
- expand it into the strongest version of the same idea
- keep it believable for the intended video type
- do not invent unrelated storylines

If the brief is detailed:
- distribute its ideas across the selected scenes in the same logical order
- preserve what makes it specific
- do not flatten it into generic creative language

━━━━━━━━ PIPELINE RULES ━━━━━━━━

anchor_tag determines the scene pipeline strategy.

If anchor_tag = "logo":
- Scene 1 scene_pipeline = "logo_integration"
- Scenes 2, 3, and 4 scene_pipeline = "style_extraction"
- The final scene scene_pipeline = "logo_integration"

If anchor_tag = "style":
- all selected scenes scene_pipeline = "style_extraction"

If anchor_tag = "character":
- all selected scenes scene_pipeline = "character_lock"

generation_mode rules:
- if anchor_tag is "logo", "product", or "character": all selected scenes use "i2i_chain"
- if anchor_tag is "style": Scene 1 uses "t2i", Later scenes use "i2i_chain"

Final scene rule:
- The final scene must feel like the natural resolution of the video
- maintain strong continuity with the previous scene
- if this is an advertisement, bring the brand memory home clearly

━━━━━━━━ STORY_STATE RULE ━━━━━━━━

For every scene, write "story_state" that clearly says:
- what stays fixed
- what changes
- why this scene exists in the video

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
    },
    {
      "scene": 5,
      "text": "...",
      "english_prompt": "...",
      "scene_pipeline": "...",
      "generation_mode": "...",
      "story_state": "..."
    }
  ]
}

Return only the number of scenes the idea needs, between 3 and 8.
Never pad the result to a fixed count.
Never return fewer than 3 scenes or more than 8 scenes.`;

    const dynamicSystemPrompt = language === 'ar'
      ? `أنت المخرج الإبداعي لفيديو Wakti.
حوّل فكرة المستخدم القصيرة إلى فيديو واحد متصل ومثير. قد يكون قصة، إعلاناً، عرض منتج، رحلة شخصية، فيديو علامة تجارية، أو أي فكرة أخرى. لا تفرض قالب إعلان.

${requestedSceneCount ? `أعد بالضبط ${requestedSceneCount} مشاهد لأن المستخدم اختار هذا العدد.` : 'اختر عدد المشاهد الذي تحتاجه الفكرة فقط، بين ٣ و٨ مشاهد. لا تستخدم عدداً ثابتاً. الفكرة البسيطة قد تحتاج ٣ مشاهد، والفكرة الأوسع قد تحتاج أكثر.'}

اجعل المشاهد قوساً بصرياً واحداً:
- بداية قوية مناسبة للفكرة
- تطور طبيعي دون إعادة تشغيل
- نهاية أو لحظة وصول مناسبة للفكرة

حافظ على هوية الشخص أو المنتج أو العالم البصري عبر المشاهد. غيّر الفعل أو المكان أو التكوين أو الإضاءة فقط عندما يخدم تطور الفكرة.
إذا وُجد مرجع بصري، احترم دوره: الشعار يبقى شعاراً ولا يُعاد رسمه، الشخصية تبقى نفسها، ومرجع النمط يحدد الألوان والضوء والمزاج فقط.
لا تخترع شعاراً أو CTA أو رسالة تجارية لم يقدمها المستخدم.

أعد JSON صالحاً فقط، بدون markdown، بهذا الشكل:
{"subject_lock":"هوية بصرية قصيرة","scenes":[{"scene":1,"text":"وصف طبيعي بلغة المستخدم","english_prompt":"وصف صورة ثابتة بالإنجليزية","scene_pipeline":"style_extraction","generation_mode":"t2i","story_state":"ما يبقى وما يتغير ولماذا"}]}
أعد من ٣ إلى ٨ مشاهد، بالعدد الذي تحتاجه الفكرة فقط. يجب أن تبدأ كل english_prompt بهوية subject_lock نفسها حرفياً.`
      : `You are Wakti's creative video director.
Turn the user's short idea into one connected, exciting video. It may be a story, advertisement, product showcase, character journey, brand film, or any other idea. Do not force an advertisement format.

${requestedSceneCount ? `Return exactly ${requestedSceneCount} scenes because the user selected that count.` : 'Choose only the number of scenes the idea needs, between 3 and 8. Do not use a fixed count. A simple idea may need 3 scenes; a broader idea may need more.'}

Build one visual arc:
- a strong opening that fits the idea
- natural development without resetting
- a satisfying ending or arrival that fits the idea

Keep the person, product, subject, and visual world consistent. Change action, setting, composition, or lighting only when it serves the idea's progression.
If a visual reference exists, respect its role: a logo stays a logo and is not redrawn, a character stays the same, and a style reference guides colors, light, and mood only.
Never invent a slogan, CTA, or commercial message the user did not provide.

Return only valid JSON, no markdown, in this shape:
{"subject_lock":"short visual identity","scenes":[{"scene":1,"text":"natural description in the user's language","english_prompt":"English still-image direction","scene_pipeline":"style_extraction","generation_mode":"t2i","story_state":"what stays, what changes, and why"}]}
Return 3 to 8 scenes, using only the number the idea needs. Every english_prompt must begin with the exact same subject_lock.`;

    const userPrompt = language === 'ar'
      ? `رؤيتي: ${vision.trim()}\n\n${requestedSceneCount ? `أعد بالضبط ${requestedSceneCount} مشاهد.` : 'أنشئ فيديو إبداعياً متصلاً بعدد مشاهد مناسب للفكرة، بين ٣ و٨ مشاهد.'} لا تفرض قالب إعلان إذا كانت الفكرة قصة أو عرضاً أو رحلة شخصية.`
      : `My vision: ${vision.trim()}\n\n${requestedSceneCount ? `Return exactly ${requestedSceneCount} scenes.` : 'Create one connected creative video using the number of scenes the idea needs, between 3 and 8.'} Do not force an advertisement format if the idea is a story, showcase, or character journey.`;

    // Call Gemini Flash-Lite via Gemini API
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: dynamicSystemPrompt }] },
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
    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const promptFeedback = geminiData?.promptFeedback;
    const aiParts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts as Array<{ text?: string }>
      : [];
    let aiContent = aiParts.map((p) => p?.text || '').join('').trim();

    if (!aiContent) {
      console.error('[cinema-director] Gemini returned no content. finishReason:', finishReason, 'promptFeedback:', JSON.stringify(promptFeedback));

      // If blocked by safety filter, surface a clear message
      if (finishReason === 'SAFETY' || promptFeedback?.blockReason) {
        throw new Error(`Content blocked by safety filter (${promptFeedback?.blockReason || finishReason}). Please rephrase your prompt.`);
      }

      // If hit MAX_TOKENS, retry once with a shorter system prompt
      if (finishReason === 'MAX_TOKENS' || finishReason === 'UNKNOWN') {
        console.log('[cinema-director] Retrying with shorter dynamic prompt...');
        const retryResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: dynamicSystemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
          }),
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryParts = Array.isArray(retryData?.candidates?.[0]?.content?.parts)
            ? retryData.candidates[0].content.parts as Array<{ text?: string }>
            : [];
          aiContent = retryParts.map((p) => p?.text || '').join('').trim();
          console.log('[cinema-director] Retry content length:', aiContent.length, 'finishReason:', retryData?.candidates?.[0]?.finishReason);
        }
      }

      if (!aiContent) {
        throw new Error(`No content returned from Gemini (finishReason: ${finishReason})`);
      }
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

    if (!scenes || scenes.length < MIN_SCENES) {
      throw new Error(`AI director returned fewer than ${MIN_SCENES} scenes`);
    }
    if (requestedSceneCount && scenes.length < requestedSceneCount) {
      throw new Error(`AI director returned ${scenes.length} scenes instead of the requested ${requestedSceneCount}`);
    }

    const normalizedScenes = scenes.slice(0, requestedSceneCount || MAX_SCENES).map((s, i) => ({
      scene: i + 1,
      text: s.text || s.english_prompt || '',
      english_prompt: s.english_prompt || s.text || '',
      scene_pipeline: s.scene_pipeline || 'style_extraction',
      generation_mode: s.generation_mode || (effectiveAnchorTag === 'logo' || effectiveAnchorTag === 'character' ? 'i2i_chain' : (i === 0 ? 't2i' : 'i2i_chain')),
      story_state: s.story_state || '',
    }));
    const localizedScenes = language === 'ar'
      ? await repairArabicSceneTexts(normalizedScenes)
      : normalizedScenes.map((scene) => ({ ...scene, text: scene.english_prompt }));

    const response: DirectorResponse = {
      success: true,
      visualDna: '',
      subject_lock: subjectLock,
      scenes: localizedScenes,
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
