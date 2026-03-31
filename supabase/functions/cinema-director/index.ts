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

★ "text" = what the USER SEES — scene description in natural language (verbatim from their input).
★ "english_prompt" = what the IMAGE AI SEES — a full photographic art-direction brief.

THESE ARE TWO COMPLETELY DIFFERENT THINGS.
The image AI generates ONE still photograph. It cannot move, rotate, zoom, or fly.
Think of yourself as a photographer's art director writing a detailed shot brief.

english_prompt RULES:
  • 40-80 words. Write full descriptive sentences or rich detail — NOT thin keyword lists.
  • MUST start with the full subject_lock value on EVERY scene — this is the continuity anchor.
  • Include ALL of: specific environment, specific lighting, camera angle/framing, mood, visual style.
  • ONE ENVIRONMENT RULE: pick either indoor OR outdoor. NEVER both in the same prompt. Never contradict yourself.
  • BANNED — video/camera motion terms, useless to a still image:
      drone shot, flying between, 360-degree, rotation, sweeping, zooms out, zooms in,
      close-up shot of, camera captures, tracking shot, pan, tilt, dolly, orbiting, spinning
  • Always end with: cinematic commercial photography, photorealistic, high detail.

WRITE PROMPTS LIKE GROK'S OWN EXAMPLE:
  "Cinematic portrait of a woman sitting by a vinyl record player, retro living room background, soft ambient lighting, warm earthy tones, nostalgic 1970s wardrobe, reflective mood, gentle film grain texture, shallow depth of field, vintage editorial photography style."
  — Notice: specific subject, specific environment, specific lighting, specific mood, specific style. That is the standard.

TRANSLATION EXAMPLES — convert scene text into proper photo briefs:

  text: "truck drives through open desert highway"
  english_prompt: "[subject_lock], driving along a vast open desert highway under blazing midday sun, endless golden sand dunes stretching to the horizon, deep blue sky with scattered clouds, low-angle front view, heat shimmer rising from hot asphalt, cinematic wide-angle automotive photography, photorealistic, high detail."

  text: "drone shot flying between skyscrapers at sunset"
  english_prompt: "[subject_lock], parked on a downtown city boulevard flanked by towering glass skyscrapers, warm golden sunset light reflecting off building facades, aerial perspective slightly above street level, long shadows cast across the road, cinematic commercial automotive photography, photorealistic, high detail."

  text: "close-up of truck's chrome wheels reflecting neon lights on wet highway"
  english_prompt: "[subject_lock], stationary on a rain-soaked city street at night, chrome wheel detail prominent in foreground, vivid neon signs and streetlights reflected in puddles on wet asphalt, low ground-level angle, dramatic neon color contrast, cinematic automotive photography, photorealistic, high detail."

  text: "sweeping 360-degree rotation captures the entire modern skyline"
  english_prompt: "[subject_lock], positioned on an elevated highway overpass at golden hour, full panoramic city skyline visible in all directions, warm amber and orange sunset hues, wide-angle establishing shot, dramatic sky with layered clouds, cinematic commercial photography, photorealistic, high detail."

  text: "truck drives through indoor distribution center"
  english_prompt: "[subject_lock], inside a massive modern logistics warehouse, crisp white LED industrial lighting from high bay ceiling, rows of storage shelving receding into background, ground-level front angle, clean industrial atmosphere, cinematic commercial automotive photography, photorealistic, high detail."

  For logo scenes: start with "The provided [brand name] logo", then describe the full background scene in the same detail.

6. OUTPUT FORMAT
Return ONLY valid JSON — no markdown:
{"subject_lock": "<12-20 word rich identity description>", "scenes": [{"scene": 1, "text": "...", "english_prompt": "<40-80 word photo brief>", "scene_pipeline": "..."}, ...]}
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
