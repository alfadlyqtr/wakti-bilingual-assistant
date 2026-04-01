// supabase/functions/cinema-director/index.ts
// Wakti Cinema Director - GPT-4o mini powered scene generation v18 (visual storytelling + art style matching)

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

    const { vision, language = 'en', scene_count = 6, anchor_tag = '' } = await req.json();
    const N = Math.max(1, Math.min(6, Number(scene_count) || 6));
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

أنت مخرج سينمائي مبدع لـ Wakti AI Cinema. مهمتك: ${isShortPrompt
  ? `خذ فكرة المستخدم القصيرة واكتب قصة سينمائية كاملة من ${N} مشاهد (١٠ ثواني لكل مشهد).

━━━ وضع التوسع الإبداعي (الموجه القصير) ━━━

المستخدم أعطاك فكرة مختصرة فقط. أنت مطالب بتوسيعها إلى ${N} مشاهد مختلفة ومتسلسلة تروي قصة سينمائية متكاملة.

القواعد:
• كل مشهد يجب أن يكون مختلفاً — لا تكرر نفس النص في أكثر من مشهد.
• اكتب قصة بتطور درامي: بداية → تصاعد → ذروة/نهاية.
• استخدم سياق المستخدم (Vibe, Setting, Action, Cast, Goal) لتوجيه القصة.
• مثال: إذا قال "فريق كرة قدم يتدرب" وN=3:
  • مشهد 1 text: "اللاعبون يسخنون ويركضون حول الملعب"
  • مشهد 2 text: "تمارين تمرير وتسديد مكثفة"  
  • مشهد 3 text: "الفريق يجتمع في حلقة والمدرب يحفزهم"`
  : `خذ رؤية المستخدم وقسّمها بالتساوي إلى ${N} مشهد سينمائي (١٠ ثواني لكل مشهد).

━━━ وضع التقطيع الحرفي (الموجه الطويل) ━━━

١. سلب الرؤية — محظور تماماً اختراع محتوى جديد
يجب أن يكون كل حقل "text" مأخوذاً حرفياً من كلمات المستخدم نفسها. لا تضيف شعارات جديدة، لا تخترع موضوعات جديدة، لا تختصر النص. قُسّم كلمات المستخدم فقط إلى فصول بصرية.
مثال: إذا قال المستخدم "شاحنة تمشي في الصحراء ثم تصل إلى المدينة ويظهر شعار ميركاب" وN=3، الناتج:
  • مشهد 1 text: "شاحنة تمشي في الصحراء"
  • مشهد 2 text: "تصل إلى المدينة"
  • مشهد 3 text: "يظهر شعار ميركاب"`}

━━━ القواعد العامة ━━━

٢. قفل الهوية البصرية (subject_lock) — الأهم على الإطلاق
هذا هو مرساة الاستمرارية. يجب أن يصف الموضوع بدقة كافية بحيث يرسم الذكاء الاصطناعي نفس الشيء في كل مشهد.

القواعد:
  • ١٢-٢٠ كلمة — ليس ٣-٨. يجب أن يكون وصفاً تفصيلياً.
  • اذكر: اللون الدقيق، شكل الهيكل، التفاصيل المميزة، المواد، أي علامات بصرية مميزة.
  • مثال ضعيف (محظور): "شاحنة زرقاء مستقبلية"
  • مثال قوي (مطلوب): "شاحنة نيمي كوبالت-أزرق انسيابية، كابينة منحنية ناعمة، زجاج بانورامي أسود، شرائط LED سيان رفيعة على الجانبين، أغطية عجلات مدمجة، تصميم ممتاز مستقبلي"
  • لا تضمّن كلمات: شعار، لوغو، علامة تجارية، wordmark.

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

★ حقل "text": ما يراه المستخدم — وصف المشهد بلغة طبيعية (من كلمات المستخدم).
★ حقل "english_prompt": ما يراه نموذج الصورة — موجز توجيهي فوتوغرافي كامل.

هذان حقلان مختلفان تماماً.
نموذج الصورة يولد صورة فوتوغرافية واحدة ثابتة. لا يستطيع التحريك أو التدوير أو التكبير.
مهمتك في english_prompt: فكر كمدير تصوير يحدد إطار لقطة واحدة.

قواعد english_prompt:
  • ٤٠-٨٠ كلمة. جمل كاملة أو وصف تفصيلي — ليس مجرد كلمات مفتاحية مقتضبة.
  • يبدأ دائماً بـ subject_lock الكامل في كل مشهد — هذا يضمن الاستمرارية البصرية.
  • يتضمن: البيئة الدقيقة، الإضاءة، زاوية الكاميرا، المزاج، الأسلوب البصري.
  • محظور تماماً: لغة حركة الكاميرا (drone shot, rotation, zooms, sweeping, camera captures).
  • قاعدة البيئة الواحدة: إما داخلي أو خارجي — لا الاثنين معاً أبداً.
  • الأسلوب المطلوب دائماً: cinematic commercial photography, photorealistic, high detail.

أسلوب الكتابة المطلوب — مثال Grok الرسمي:
"Cinematic portrait of a woman sitting by a vinyl record player, retro living room background, soft ambient lighting, warm earthy tones, nostalgic 1970s wardrobe, reflective mood, gentle film grain texture, shallow depth of field, vintage editorial photography style."

تحويل لغة المشاهد إلى موجز فوتوغرافي:

مشهد: "شاحنة تسير في الصحراء"
english_prompt: "[subject_lock], driving along a vast open desert highway under a blazing midday sun, endless golden sand dunes stretching to the horizon, deep blue sky with scattered clouds, low-angle front view, heat shimmer rising from the asphalt, cinematic wide-angle automotive photography, photorealistic, high detail."

مشهد: "طائرة مسيّرة بين ناطحات السحاب عند الغروب"
english_prompt: "[subject_lock], parked on a downtown city boulevard flanked by towering glass skyscrapers, warm golden sunset glow reflecting off the building facades, aerial perspective looking down at a slight angle, long shadows across the road, cinematic commercial automotive photography, photorealistic, high detail."

مشهد: "عجلات الشاحنة تعكس أضواء النيون"
english_prompt: "[subject_lock], stopped on a wet city street at night, chrome wheels macro detail visible in foreground, vivid neon signs and streetlights reflected in rain puddles on the asphalt, low angle ground-level view, dramatic contrast between light and shadow, cinematic automotive photography, photorealistic, high detail."

لمشاهد الشعار: يبدأ بـ "The provided [brand] logo" ثم يصف البيئة الخلفية.

٦. تنسيق الإخراج
أعد JSON صالحاً فقط — بدون markdown:
{"subject_lock": "<١٢-٢٠ كلمة>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<٤٠-٨٠ كلمة>", "scene_pipeline": "..."}, ...]}
أعد ${N} مشهداً بالضبط.`
      : `⚠️ LANGUAGE LOCK — NON-NEGOTIABLE: "text" field MUST be in ENGLISH only. Violation = task failure.

You are the AI Cinematic Director for Wakti AI Cinema. Your job: ${isShortPrompt
  ? `take the user's SHORT concept and CREATE a full cinematic story of exactly ${N} unique scene${N > 1 ? 's' : ''} (10 seconds each).

━━━ STORY EXPANSION MODE (short prompt) ━━━

The user gave you a brief concept or idea. You MUST expand it into ${N} DIFFERENT, PROGRESSIVE scenes that tell a cinematic story with a beginning, middle, and end.

RULES:
• Every scene MUST have DIFFERENT text — NEVER repeat the same text across scenes.
• Create a dramatic arc: setup → development → climax/resolution.
• Use the user's context clues (Vibe, Setting, Action, Cast, Goal) to guide the story direction.
• Each scene should describe a specific, distinct visual moment.

Example: If user says "soccer team practicing" with N=3:
  • Scene 1 text: "Players warming up with stretches and jogs around the pitch"
  • Scene 2 text: "Intense passing drills and shooting practice on goal"
  • Scene 3 text: "Team huddle together as coach gives a motivating speech"

Example: If user says "cat sleeping" with N=3:
  • Scene 1 text: "A fluffy cat curled up on a sunny windowsill"
  • Scene 2 text: "The cat stretches lazily and yawns"
  • Scene 3 text: "The cat settles back down into a peaceful deep sleep"

DO NOT just copy the user's short prompt into every scene — that defeats the purpose.`
  : `take the User Vision and divide it into exactly ${N} cinematic 10-second scene${N > 1 ? 's' : ''}.

━━━ WORD-FOR-WORD SLICING MODE (detailed prompt) ━━━

The user provided a detailed vision. Break their literal words into ${N} visual chapters in the order they were written.

YOU ARE STRICTLY FORBIDDEN FROM:
• Adding new slogans, taglines, or closing text that the user did not write.
• Inventing new themes, story beats, or creative elements.
• Summarizing or paraphrasing the user's words.

1. WORD-FOR-WORD SLICING — CRITICAL
Every "text" field MUST be taken verbatim from the user's input. Do not add, invent, or summarize.
Example: If user says "truck drives through desert then arrives at city then Merkab logo appears" with N=3:
  • Scene 1 text: "truck drives through desert"
  • Scene 2 text: "arrives at city"
  • Scene 3 text: "Merkab logo appears"`}

━━━ UNIVERSAL RULES ━━━

2. SUBJECT LOCK — THE CONTINUITY ANCHOR (Most important field)
This is what makes all 6 images look like they belong to the same film.
If this is weak, every scene generates a different-looking subject. That is the continuity failure.

Rules:
  • 12-20 words — NOT 3-8. Must be a rich identity description.
  • Include: exact color, body shape, defining design details, materials, any distinctive visual markers.
  • WEAK (forbidden): "futuristic blue semi-truck"
  • STRONG (required): "cobalt-blue aerodynamic semi-truck, smooth curved cab, black panoramic windshield band, thin cyan LED accent strips on both sides, flush integrated wheel covers, premium futuristic design"
  • NEVER include: logo, brand, emblem, wordmark, insignia.

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

★ "text" = what the USER SEES — scene description in natural language.
★ "english_prompt" = what the IMAGE AI SEES — a detailed visual art-direction brief for ONE still image.

The image AI generates ONE still image. It cannot animate, rotate, zoom, or fly.
Your job: write a detailed visual brief that tells the AI exactly what to draw.

━━━ VISUAL STORYTELLING — HOW TO MAKE SCENES LOOK DIFFERENT ━━━

THE #1 RULE: Each scene MUST look visually distinct. If all scenes show the same composition, same angle, same pose — the video will look like a slideshow of the same image repeated.

TO MAKE SCENES DIFFERENT, vary these across scenes:
  • ACTION/POSE: What are the characters/subjects doing? (stretching vs kicking vs celebrating)
  • COMPOSITION: How are characters arranged? (group line vs circle huddle vs scattered action)
  • CAMERA ANGLE: (wide establishing vs medium group vs ground-level dynamic)
  • FRAMING: (full body group vs waist-up vs hero close-up with background blur)
  • LIGHTING/TIME: (morning warmup vs bright midday vs golden hour)
  • EMOTION: (focused concentration vs energetic intensity vs joyful celebration)

DO NOT just change the environment/location for every scene. Characters doing the same pose in different locations is NOT storytelling.

━━━ english_prompt RULES ━━━

  • 40-80 words. Write full descriptive sentences — NOT thin keyword lists.
  • MUST start with the full subject_lock value on EVERY scene — this is the continuity anchor.
  • Include: specific action/pose, composition, camera angle, lighting, mood/emotion, visual style.
  • BANNED — video/camera motion terms (useless to a still image):
      drone shot, flying between, 360-degree, rotation, sweeping, zooms out, zooms in,
      camera captures, tracking shot, pan, tilt, dolly, orbiting, spinning

━━━ ART STYLE MATCHING ━━━

CRITICAL: Match the art style to the content. Do NOT force "photorealistic" on everything.
  • If the user's reference image is cartoon/anime/3D animated → use: "vibrant 3D animated style, colorful, expressive characters, high detail"
  • If the user's reference image is photorealistic → use: "cinematic photography, photorealistic, high detail"
  • If no reference image → default to: "cinematic commercial photography, photorealistic, high detail"
  • If anchor_tag is "character" → ALWAYS match the art style of the uploaded character image.

━━━ EXAMPLES — CHARACTER STORYTELLING ━━━

  text: "Players warming up with stretches and jogs"
  english_prompt: "[subject_lock], lined up in two rows doing synchronized stretching exercises on a green soccer pitch, morning sunlight casting long shadows, wide establishing shot from sideline angle, determined and focused expressions, vibrant 3D animated style, colorful, high detail."

  text: "Intense passing drills and shooting practice"
  english_prompt: "[subject_lock], in dynamic mid-action poses passing and kicking soccer balls across the pitch, one player mid-kick with leg extended, ball frozen in mid-air, bright midday lighting, medium shot at field level showing full body movement, energetic and competitive mood, vibrant 3D animated style, high detail."

  text: "Team huddle together as coach gives a motivating speech"
  english_prompt: "[subject_lock], gathered in a tight circle huddle with arms around each other's shoulders, seen from slightly above, warm golden hour backlighting creating rim light on their hair and uniforms, joyful smiling expressions, intimate group composition, vibrant 3D animated style, emotional, high detail."

━━━ EXAMPLES — PRODUCT/COMMERCIAL ━━━

  text: "truck drives through open desert highway"
  english_prompt: "[subject_lock], driving along a vast open desert highway under blazing midday sun, endless golden sand dunes to the horizon, deep blue sky, low-angle front view, heat shimmer rising from asphalt, cinematic automotive photography, photorealistic, high detail."

  text: "truck parked in modern city at night"
  english_prompt: "[subject_lock], stationary on a rain-soaked city street at night, vivid neon signs reflected in puddles on wet asphalt, low ground-level angle, dramatic neon color contrast, cinematic automotive photography, photorealistic, high detail."

  For logo scenes: start with "The provided [brand name] logo", then describe the background.

6. GENERATION MODE — HYBRID T2I / I2I CHAIN
For story continuity, assign each scene a generation mode:
  • "t2i" = fresh text-to-image generation (no previous image needed)
  • "i2i_chain" = image-to-image from the PREVIOUS scene's output (chains the story)

MANDATORY GENERATION MODE RULES:
  • Scene 1: always "t2i" (opening tableau, no previous image)
  • Scene 2: always "t2i" — THIS IS THE MASTER ANCHOR. This scene defines the canonical look of the subject for all following scenes.
  • Scene 3: always "i2i_chain" from Scene 2 — inherits exact truck/subject form
  • Scene 4: always "i2i_chain" from Scene 3 — continues the story state
  • Scene 5: always "i2i_chain" from Scene 4 — escalation beat
  • Scene 6: always "i2i_chain" from Scene 5 — resolution/ending
  EXCEPTION: If Scene 1 is a logo/brand tableau (no truck visible), keep Scene 2 as "t2i" master anchor.

7. STORY STATE — WHAT STAYS, WHAT CHANGES
For EVERY scene, define the story_state field. This is a short English description of:
  • What remains fixed from the previous scene (subject form, trailer state, etc.)
  • What changes (environment, lighting, camera focus, time of day)
  • What is the narrative purpose of this scene beat

Example story_state values:
  Scene 2: "Master anchor — full truck with attached trailer established in warehouse, crisp white lighting, hero front angle. All following scenes inherit this exact truck form."
  Scene 3: "Same truck, same trailer attached, same body proportions. Environment changes to downtown city boulevard at sunset. Escalation in scale."
  Scene 4: "Same truck, same trailer, scene continues from city boulevard. Camera focus shifts to chrome wheel detail and wet neon reflections. Intimate texture beat."
  Scene 5: "Same truck, same trailer. Environment opens to full city skyline panorama. Epic payoff wide shot."
  Scene 6: "Same truck, same trailer, enters tunnel. Brand resolution moment. Logo presence and tagline."

8. OUTPUT FORMAT
Return ONLY valid JSON — no markdown:
{"subject_lock": "<12-20 word rich identity description>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<40-80 word photo brief>", "scene_pipeline": "...", "generation_mode": "t2i", "story_state": "..."}]}
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
