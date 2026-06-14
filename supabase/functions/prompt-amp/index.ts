import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── User ID Extraction from JWT ───
function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.split(".").length !== 3) return null;
    const payloadB64 = token.split(".")[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload.sub || null;
  } catch {
    return null;
  }
}

// ─── AI Logger (inlined) ───
interface AILogParams {
  functionName: string;
  userId?: string;
  model: string;
  inputText?: string;
  outputText?: string;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const inputTokens = estimateTokens(params.inputText);
    const outputTokens = estimateTokens(params.outputText);
    const cost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;

    const { error } = await supabase.rpc("log_ai_usage", {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.inputText ? params.inputText.substring(0, 2000) : null,
      p_response: params.outputText ? params.outputText.substring(0, 2000) : null,
      p_metadata: params.metadata || {},
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: cost,
    });

    if (error) console.error("[aiLogger] RPC error:", error);
    else console.log(`[aiLogger] ✅ Logged: ${params.functionName}`);
  } catch (err) {
    console.error("[aiLogger] Error:", err);
  }
}
// ─── End AI Logger ───

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function hasArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text || "");
}

function detectOutputLanguage(text: string): "ar" | "en" | "mixed" {
  const input = text || "";
  const hasAr = /[\u0600-\u06FF]/.test(input);
  const hasEn = /[A-Za-z]/.test(input);
  if (hasAr && hasEn) return "mixed";
  if (hasAr) return "ar";
  return "en";
}

function buildSystemPrompt(preferArabic: boolean, mode?: string) {
  const isI2I = mode === "image2image";
  const isBG = mode === "background-removal";
  const isMusic = mode === "music";
  const isLyrics = mode === "lyrics";

  const isText2Video = mode === "text2video";
  const isSlideDesign = mode === "slide-design";

  if (preferArabic) {
    if (isSlideDesign) {
      return [
        "أنت مدير تصميم شرائح عرض تقديمي.",
        "مهمتك: أعد صياغة الفكرة التصميمية للمستخدم كتوجيه تصميمي حاد وواضح لشريحة HTML.",
        "صِف: الخلفية (ألوان/تدرجات/تأثيرات)، الخطوط، معالجة البطاقات والنقاط، المزاج البصري.",
        "كن محدداً في قيم الألوان (مثل #1a1a2e) والتأثيرات (مثل glow, glassmorphism, gradient borders).",
        "لا تتحدث مع المستخدم. لا تشرح. أخرج فقط التوجيه التصميمي المحسّن بحد أقصى 200 كلمة.",
      ].join(" ");
    }
  }

  if (!preferArabic) {
    if (isSlideDesign) {
      return [
        "You are a slide design director for premium HTML presentations.",
        "Your job: rewrite the user's rough design idea into a sharp, vivid design direction.",
        "Describe: background (colors/gradients/effects), typography style, bullet card treatment, accent colors, mood and atmosphere.",
        "Be specific with hex colors and CSS effects (e.g. glassmorphism, neon glow, gradient borders, text-shadow glow).",
        "Do NOT chat with the user. No explanations. Output ONLY the enhanced design direction, max 200 words.",
      ].join(" ");
    }
  }

  if (preferArabic) {
    if (isText2Video) {
      return [
        "أنت مجمّع مطالبات رئيسي لوضع تحويل النص إلى فيديو.",
        "مهمتك: تحويل طلب المستخدم إلى وصف سينمائي عالي الدقة مع الحفاظ الصارم على لغة الإدخال.",
        "قوانين صارمة:",
        "- إذا كان الإدخال بالعربية فالمخرج بالعربية فقط.",
        "- إذا كان الإدخال بالإنجليزية فالمخرج بالإنجليزية فقط.",
        "- إذا كان الإدخال مختلطاً (عربي + إنجليزي) فحافظ على نفس توزيع اللغات بدون فرض ترجمة كاملة.",
        "- لا تحذف أي اسم علامة أو عنصر أو كيان طلبه المستخدم.",
        "- إذا طلب المستخدم نصاً يظهر داخل المشهد، ضع النص المطلوب بين علامتي اقتباس بشكل حرفي.",
        "- اكتب المشهد والحركة والكاميرا والإضاءة بزمن حركي واضح خلال 4-8 ثوانٍ.",
        "- ممنوع الرد الحواري أو الشرح.",
        "المخرج: فقرة سينمائية واحدة محسّنة باللغة نفسها مع تفاصيل حركة احترافية."
      ].join(" ");
    }

    if (isMusic) {
      return [
        "أنت منتِج موسيقي خبير يعيد صياغة موجز موسيقي كسطر واحد واضح وطبيعي (ليس قائمة شروط).",
        "قواعد صارمة:",
        "- لا تُدرج أي كلمات غنائية في الناتج. الناتج موجز موسيقي فقط.",
        "- احترم الأسلوب/المزاج/البنية/الإيقاع/السرعة/المقامات/الآلات، ولا تنجرف عن نية المستخدم.",
        "- التزم بالقيود الأمنية (عدم إضافة آلات جديدة عند تفعيل السلامة).",
        "- إذا وُجدت مدة مستهدفة/خريطة توزيع، لخّصها بكلمات منتج موسيقي.",
        "- أعد المخرج باللغة نفسها.",
        "المخرج: سطر واحد مختصر بنص عادي فقط دون أي كلمات غنائية."
      ].join(" ");
    }

    if (isLyrics) {
      return [
        "أنت شاعر/كاتب أغاني ماهر. أنشئ/أكمل كلمات قابلة للغناء بصور جديدة ومجازات رشيقة ولغة طبيعية.",
        "قواعد صارمة:",
        "- إن احتوى الإدخال على مقطع يبدأ بـ FACTS: (حتى سطر فارغ)، فاعتبره حقائق ثابتة لا يجوز مخالفتها (عنوان، أنماط، آلات، مزاج، مدة، ترتيب).",
        "- إن احتوى الإدخال على SEED LYRICS: فاحفظ الأسطر كما هي واصل بنفس الزمن/الضمير/النبرة.",
        "- تجنّب الكليشيهات والحشو وتكرار الأسطر، ولا تعكس العنوان حرفيًا إلا كسطر رنّان واحد.",
        "- التزم بالميزان وسلاسة الغناء؛ عند الطلب حافظ على نافذة 7–10 مقاطع وقوافٍ خفيفة/قريبة.",
        "- أعد فقط نص الكلمات النهائية دون شروح أو عناوين أقسام.",
        "- أعد المخرج باللغة نفسها."
      ].join(" ");
    }

    if (isBG) {
      return [
        "أنت مهندس مطالبات خبير لنموذج تعديل صور متقدم. مهمتك هي إعادة صياغة طلب المستخدم إلى تعليمة تعديل واحدة واضحة تصف النتيجة النهائية للصورة.",
        "قواعد صارمة:",
        "- حافظ على الشخص/الموضوع كما هو تمامًا: لا تغيّر الهوية أو الوجه أو ملامح الوجه أو العمر أو ملمس البشرة أو الشعر أو العينين أو شكل الجسم أو الوضعية أو الملابس أو الشعارات أو النِسب أو أي تفاصيل مميزة.",
        "- ممنوع تحسين/تجميل/رتوش للوجه أو تغيير تفاصيل الشخص. يُسمح فقط بتعديلات عامة على الإضاءة/الألوان إذا كانت لا تغيّر هوية الشخص أو ملامحه.",
        "- طبّق فقط التغييرات التي طلبها المستخدم صراحةً. لا تضف أفكارًا أو تحسينات إضافية من عندك إلا إذا طلبها المستخدم.",
        "- حافظ على الهدف الأساسي لطلب المستخدم واجعل الناتج مناسبًا لنموذج تعديل الصور.",
        "- لا تتحدث مع المستخدم. لا تقل «فهمت» أو «سأقوم». لا تكتب خطوات أو شروح أو تعليقات.",
        "شكل المخرج:",
        "- أعد جملة واحدة أو فقرة قصيرة واحدة كنص عادي فقط تصف التعديلات النهائية المطلوبة.",
        "- يجب أن تتضمن التعليمة تأكيدًا واضحًا أن الشخص/الموضوع يبقى دون تغيير.",
        "- بدون تحيات، بدون تأكيدات، بدون تعداد نقطي."
      ].join(" ");
    }

    if (isI2I) {
      return [
        "أنت محسّن مطالبات خبير لتحرير الصور (Image-to-Image) على صورة مرفوعة.",
        "المستخدم أرفق صورة وكتب تعليمة تحرير. مهمتك تحسين تعليمته، وليس إعادة كتابتها كمطالبة إنشاء صورة من الصفر.",
        "قواعد صارمة:",
        "- احفظ نية المستخدم الأصلية تمامًا. إذا قال 'اجعله يرتدي نظارات'، أبقِ هذه التعليمة كما هي.",
        "- أبقِ لغة التحرير الأمرية (أضف، أزل، اجعل، غيّر، أبقِ، إلخ).",
        "- أبقِ الإشارات للشخص (هو، هي، الشخص، الرجل، إلخ) — لا تحوّلها لوصف عام.",
        "- أضف تفاصيل مفيدة: إضاءة، واقعية، كلمات جودة (تركيز حاد، إضاءة طبيعية، تفاصيل دقيقة، إلخ).",
        "- الشخص/الموضوع في الصورة المرفوعة يجب أن يبقى دون تغيير (نفس الوجه، الهوية، الوضعية، الملابس) إلا إذا طلب المستخدم تغييره صراحةً.",
        "- لا تحوّل التعليمة إلى مطالبة 'إنشاء من الصفر'. هذا تعديل على صورة موجودة.",
        "- لا تتحدث، لا تشرح، لا تضف تعليقات. أخرج فقط تعليمة التحرير المحسّنة.",
        "شكل المخرج: جملة واحدة أو فقرة قصيرة تحسّن تعليمة المستخدم مع الحفاظ على نيته بالضبط."
      ].join(" ");
    }

    // Default: text-to-image
    return [
      "أنت مهندس مطالبات خبير لنماذج تحويل النص إلى صورة.",
      "افهم فكرة المستخدم، ثم أعد صياغتها كمطالبة (prompt) واحدة واضحة ومختصرة لإنشاء صورة.",
      "ركّز على الأسلوب، الألوان، الإضاءة، التكوين، المزاج، وأي عناصر مهمة.",
      "لا تتحدث مع المستخدم، لا تشرح، ولا تضف تعليقات؛ فقط جملة أو فقرة قصيرة تصف الصورة المستهدفة."
    ].join(" ");
  } else {
    if (isMusic) {
      return [
        "You are an expert music producer. Rewrite the input as a single natural producer brief line (not a checklist).",
        "Hard rules:",
        "- Do NOT include any song lyrics. Output must be a musical brief only.",
        "- Honor style, mood, structure, tempo, scales/modes, and instrumentation without drifting from user intent.",
        "- Respect safety constraints (no new instruments when safety is on).",
        "- If target duration or arrangement is present, summarize them in producer language.",
        "- Keep output language the same as the input.",
        "Output: exactly one concise plain-text line, no lyrics."
      ].join(" ");
    }

    if (isLyrics) {
      return [
        "You are a skilled poet‑songwriter. Generate or continue singable lyrics with fresh imagery and elegant metaphors.",
        "Hard rules:",
        "- If the input contains a block starting with FACTS: (until a blank line), treat those as immutable facts (title, styles, instruments, mood, duration, arrangement). Do not contradict them.",
        "- If the input contains SEED LYRICS:, preserve those lines verbatim and continue in the same tense, POV, and voice.",
        "- Avoid clichés and filler; do not repeat lines; do not echo the title verbatim except once as a hook if needed.",
        "- Keep a clear meter; when requested, aim for a 7–10 syllable window and light/near rhymes.",
        "- Return only the final lyrics text; no headings, section labels, or commentary.",
        "- Keep output language the same as input."
      ].join(" ");
    }

    if (isBG) {
      return [
        "You are an expert prompt engineer for an advanced IMAGE EDITING model. Your job is to rewrite the user’s request into ONE clear edit instruction describing the desired final image.",
        "Hard rules:",
        "- Preserve the subject EXACTLY. Do not change the person/subject’s identity, face, facial features, age, skin texture, hair, eyes, body shape, pose, clothing, logos, proportions, or any defining details.",
        "- Do NOT beautify, retouch, or “enhance” the subject, and do not change facial details. You may adjust global lighting/color only if it does not alter the subject’s identity.",
        "- Apply ONLY the changes explicitly requested by the user. Do not add extra improvements or creative ideas unless the user asked for them.",
        "- Maintain the core goal of the request and keep the output practical for an image editing model.",
        "- Do NOT speak to the user. Do NOT say you understand or will do anything. Do NOT add steps, explanations, or comments.",
        "Output format:",
        "- Return exactly ONE plain-text sentence or short paragraph describing the final desired edits.",
        "- The instruction must explicitly state that the subject remains unchanged.",
        "- No greetings, no confirmations, no bullet points."
      ].join(" ");
    }

    if (isText2Video) {
      return [
        "You are the WAKTI_AI Master Prompt Compiler for Text-to-Video.",
        "Your job: compile user intent into one dense, cinematic, machine-usable video prompt.",
        "Hard rules:",
        "- STRICT LANGUAGE LOCK: preserve the user's input language exactly.",
        "- Arabic input => Arabic output. English input => English output. Mixed input => keep mixed layout naturally.",
        "- Do NOT remove or replace any requested noun, brand, object, or keyword.",
        "- If the user asks for visible text inside the scene, preserve it exactly in quotation marks.",
        "- Enforce dynamic movement over a 4-8 second timeline with clear camera vector and environmental motion.",
        "- Do NOT chat, explain, or add filler.",
        "Output: one high-fidelity cinematic paragraph in the same language as the input."
      ].join(" ");
    }

    if (isI2I) {
      return [
        "You are an expert prompt enhancer for Image-to-Image editing of an UPLOADED PHOTO.",
        "The user has attached an image and written an edit instruction. Your job is to ENHANCE their instruction, NOT rewrite it into a text-to-image prompt.",
        "Hard rules:",
        "- PRESERVE the user's original intent exactly. If they say 'make him wear glasses', keep 'make him wear glasses' as the core instruction.",
        "- KEEP imperative edit language (add, remove, make, change, keep, etc.).",
        "- KEEP subject references (him, her, the person, the man, etc.) — do NOT convert to generic descriptions.",
        "- ADD helpful details: lighting, realism, quality keywords (sharp focus, natural lighting, detailed textures, etc.).",
        "- The subject/person in the uploaded image must remain UNCHANGED (same face, identity, pose, clothing) unless the user explicitly asks to change them.",
        "- Do NOT turn the instruction into a 'generate from scratch' prompt. This is an EDIT to an existing photo.",
        "- Do NOT chat, explain, or add commentary. Output only the enhanced edit instruction.",
        "Output format: One sentence or short paragraph that enhances the user's edit instruction while preserving their exact intent."
      ].join(" ");
    }

    // Default: text-to-image
    return [
      "You are an expert prompt engineer for Text-to-Image models.",
      "Understand the user's idea and rewrite it as a single, clear prompt for image generation.",
      "Focus on style, composition, colors, lighting, mood, and important details.",
      "Do not talk to the user or explain; return only one concise description of the desired image."
    ].join(" ");
  }
}

const VISUAL_ADS_SYSTEM_PROMPT = `You enhance structured poster prompts for Nano-Banana-2.

Your job is to make the user's existing visual-ads prompt clearer, stronger, and more production-ready WITHOUT destroying its structure.

HARD RULES:
1. PRESERVE THE EXISTING FORMAT.
   - Keep the prompt as a structured multi-line poster brief.
   - Do NOT compress it into one paragraph.
   - Do NOT rewrite it as ad copy.
   - Do NOT add quotation marks around the whole answer.
2. PRESERVE ALL ASSET ROLE LINES.
   - If the input contains lines like "- Image 1 ...", "- Image 2 ...", keep them.
   - Do NOT remove image-role instructions.
   - You may strengthen them, but you must preserve which image does what.
3. PRESERVE THE FORMAT / PLATFORM LINE.
   - If the input contains "Target format:" keep it.
4. PRESERVE CTA BEHAVIOR.
   - If the CTA is described as poster text or a callout, keep that meaning.
   - Do NOT turn it into app UI copy or a tappable button.
5. PRESERVE THE USER'S CORE INTENT.
   - Never replace their concept with a different concept.
   - Never remove key composition instructions.
6. ENHANCE ONLY BY IMPROVING CLARITY.
   - Make wording more specific, visual, and model-friendly.
   - Add useful poster/composition/detail language only when it supports the existing intent.
   - Keep the result concise but structured.
7. STRICT LANGUAGE LOCK.
   - Preserve the user's language exactly.
   - Arabic input => Arabic output.
   - English input => English output.
   - Mixed Arabic+English input => keep mixed layout naturally without forcing full translation.
8. TYPOGRAPHY PROTECTION.
   - If visible text must appear in the generated asset, preserve that exact text in quotation marks.

OUTPUT RULES:
- Output ONLY the improved structured prompt.
- Keep line breaks.
- Keep the poster brief readable and easy to edit.
- Same language layout as the input.`;

async function ampVisualAdsWithOpenAI(
  userIdea: string,
  assetsCount: number,
  tagList: string[],
  ctaText: string,
  topicLabel: string,
  topicPrompt: string,
  styleLabel: string,
  stylePrompt: string,
  platform: string,
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const requestedLanguage = detectOutputLanguage(userIdea);
  const languageLockInstruction = requestedLanguage === "ar"
    ? "STRICT LANGUAGE LOCK: Return the full improved prompt in Arabic only. Do not translate Arabic content to English."
    : requestedLanguage === "en"
      ? "STRICT LANGUAGE LOCK: Return the full improved prompt in English only."
      : "STRICT LANGUAGE LOCK: Preserve the mixed Arabic/English layout from input. Do not force full translation.";

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.55,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: VISUAL_ADS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          "Improve this structured visual-ads prompt while preserving its line-by-line poster format.",
          "Keep all image-role lines, keep the target format line, and keep CTA behavior as poster text.",
          languageLockInstruction,
          "Return only the improved structured prompt.",
          "",
          "PROMPT TO ENHANCE:",
          userIdea,
          "",
          "SUPPORTING CONTEXT:",
          `Assets Provided: ${assetsCount} images`,
          `Tags: ${tagList.length > 0 ? tagList.join(", ") : "None specified"}`,
          `Format/Platform: ${platform || "9:16"}`,
          `Ad Topic: ${topicLabel || "None selected"}`,
          `Ad Topic Detail: ${topicPrompt || "None specified"}`,
          `CTA: ${ctaText || "None"}`,
          `Style Direction: ${styleLabel || "None selected"}`,
          `Style Detail: ${stylePrompt || "None specified"}`,
        ].join("\n"),
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-visual-ads",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
}

// ─── Music/Lyrics Amp (OpenAI gpt-4o-mini) ───
const MUSIC_LYRICS_SYSTEM_PROMPT = `You are a song structure assistant. Your ONLY job is to take the user's lyrics and expand them into a complete song with proper sections.

CRITICAL RULES:
1. NEVER rewrite or change the user's words. Use their lyrics EXACTLY as written.
2. Your ONLY job is to organize and expand into song sections (Verse, Chorus, Bridge, Outro).
3. If the user provides a short line or phrase, expand it into a full song using their style and theme.
4. Track duration determines structure:
   - 30s: Verse + Chorus + Outro (minimal)
   - 60s: Verse 1 + Chorus + Verse 2 + Chorus + Outro
   - 90s+: Full structure with Bridge

5. Output ONLY the structured lyrics with section labels like:
   (Verse 1)
   [lyrics here]
   
   (Chorus)
   [lyrics here]

6. If style/mood/instruments are provided, weave them into the expansion naturally.
7. Keep the user's original language (Arabic or English).
8. Never add explanations, only return the song sections.`;

async function ampMusicLyricsWithOpenAI(
  input: string,
  durationSeconds: number
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content: MUSIC_LYRICS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Track duration: ${durationSeconds}s\n\nUser lyrics:\n${input}`,
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-music-lyrics",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
}

// DEPRECATED: Old DeepSeek implementation for non-music modes
async function ampPromptWithDeepSeek(
  input: string,
  preferArabic: boolean,
  mode?: string
): Promise<string> {
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
  if (!DEEPSEEK_API_KEY) throw new Error("CONFIG: Missing DEEPSEEK_API_KEY");

  const system = buildSystemPrompt(preferArabic, mode);
  const isLyrics = mode === "lyrics";
  const isMusic = mode === "music";
  const temperature = isLyrics ? 0.25 : isMusic ? 0.3 : 0.5;

  const payload = {
    model: "deepseek-chat",
    temperature,
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: input,
      },
    ],
  };

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "deepseek",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  const alt = data?.choices?.[0]?.text || data?.text;
  if (typeof alt === "string" && alt.trim().length > 0) {
    return alt.trim();
  }
  throw new Error("deepseek_empty_response");
}

// ─── Image-to-Video Amp (OpenAI gpt-4o-mini vision) ───
const IMAGE2VIDEO_SYSTEM_PROMPT = `You are the WAKTI_AI Master Prompt Compiler for Image-to-Video.

CRITICAL LANGUAGE LAWS:
- Preserve the user's primary input language exactly.
- Arabic input => Arabic output. English input => English output. Mixed input => keep mixed layout without forced full translation.
- If user requests visible scene text, preserve exact text in strict quotation marks.

MISSION:
- Read the uploaded reference image and user intent.
- Keep the main subject as the focal point.
- Compile a cinematic motion prompt for a 6-10 second sequence with physically plausible motion.

MANDATORY OUTPUT FORMAT (same language as input):
Initial Scene: [Detailed description of the static layout].
Camera Motion: [Explicit camera vector and tracking instructions].
Environmental Dynamics: [Micro-movements and particle simulation instructions], continuous fluid 24fps kinetic flow.

HARD RULES:
- Do NOT remove any requested noun, brand, object, or keyword.
- Do NOT add conversational text.
- Output ONLY the compiled prompt payload.`;

async function ampImage2VideoWithOpenAI(
  imageUrl: string,
  brandDetails?: string,
  environment?: string,
  duration?: string,
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const userParts: string[] = [];
  if (brandDetails && brandDetails.trim()) {
    userParts.push(`Brand/business details: ${brandDetails.trim()}`);
  }
  if (environment && environment.trim() && environment.trim().toLowerCase() !== "auto") {
    userParts.push(`Desired environment/setting: ${environment.trim()}`);
  }
  if (duration) {
    userParts.push(`Video duration: ${duration} seconds`);
  }
  userParts.push("Analyze the attached image and generate the JSON video prompt.");

  const userText = userParts.join("\n");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content: IMAGE2VIDEO_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: decodeURIComponent(imageUrl).trim(), detail: "low" },
          },
          {
            type: "text",
            text: userText,
          },
        ],
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-image2video",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:text|markdown|md)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return cleaned;
}
// ─── End Image-to-Video Amp ───

// ─── Text-to-Video Amp (OpenAI gpt-4o-mini) ───
const TEXT2VIDEO_SYSTEM_PROMPT = `You are the WAKTI_AI Master Prompt Compiler for Text-to-Video.

CRITICAL LANGUAGE LAWS:
- Strictly preserve the user's language.
- Arabic input => Arabic output. English input => English output. Mixed input => maintain mixed structure naturally.
- If user asks for words in-scene, keep exact typography inside quotation marks.

PROCESSING CHAIN:
1) Scene Establishment: lock opening visual environment and subject quickly.
2) Temporal Progression: script continuous motion across a 4-8 second timeline.
3) Commercial Glaze: inject premium lighting, grading, and motion quality.

HARD RULES:
- Static shots are failure; output must include movement.
- Preserve every requested noun, brand, object, and key detail.
- Output only compiled payload. No conversational filler.

OUTPUT FORMAT (same language as input):
Cinematic commercial sequence. Opening: [Visual composition and starting camera angle]. Action Vector: [How core subject/environment evolve seamlessly]. Technical Finish: [Camera profile, volumetric lighting, commercial-grade motion tracking].`;

async function ampText2VideoWithOpenAI(userText: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content: TEXT2VIDEO_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userText,
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-text2video",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
}
// ─── End Text-to-Video Amp ───

// ─── 2Images-to-Video Amp (OpenAI gpt-4o-mini vision with dual images) ───
const IMAGES2VIDEO_SYSTEM_PROMPT = `You are the WAKTI_AI Master Prompt Compiler for Dual-Image-to-Video.

CRITICAL LANGUAGE LAWS:
- Preserve user language exactly.
- Arabic input => Arabic output. English input => English output. Mixed input => maintain mixed language layout.
- If user requests visible text, keep exact text in quotation marks.

FRAME CONSTRAINT:
- Image 1 is opening state (first ~30%).
- Transition is middle transformation (middle ~30%).
- Image 2 is final locked state (final ~40%) and must hold clearly.

HARD RULES:
- No random extra objects.
- No identity drift for key subjects/logo/objects.
- Preserve all requested nouns, brands, and objects.
- Output only compiled payload.

OUTPUT FORMAT (same language as input):
Sequence begins locked on [Detailed Frame A elements for first 30% duration]. Transition Mechanics: [Specific structural transformation instructions for middle 30% duration]. Final Tableau: Sequence resolves and locks perfectly onto [Detailed Frame B elements holding for the final 40% duration], zero artifacting, zero ghosting, pristine temporal interpolation.`;

async function amp2Images2VideoWithOpenAI(
  imageUrl1: string,
  imageUrl2: string,
  userText?: string,
  duration?: string,
  aspectRatio?: string,
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

  const userParts: string[] = [];
  
  // Always include user text if provided
  if (userText && userText.trim()) {
    userParts.push(`User's intent: ${userText.trim()}`);
  }
  
  if (duration) {
    userParts.push(`Video duration: ${duration} seconds`);
  }
  
  if (aspectRatio) {
    userParts.push(`Aspect ratio: ${aspectRatio}`);
  }
  
  userParts.push("Image 1 is the START FRAME (opening). Image 2 is the END FRAME (closing). Generate a video prompt that opens on Image 1 and ends on Image 2, with a smooth cinematic transition between them. HARD CONSTRAINT: Keep the same colors, shape, and identity from both images. No new symbols, no extra text, no random letters — unless explicitly mentioned in the user's prompt.");

  const userPrompt = userParts.join("\n");

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content: IMAGES2VIDEO_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: decodeURIComponent(imageUrl1).trim(), detail: "low" },
          },
          {
            type: "image_url",
            image_url: { url: decodeURIComponent(imageUrl2).trim(), detail: "low" },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(
      JSON.stringify({
        stage: "openai-2images2video",
        status: resp.status,
        body: data || null,
      }),
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("openai_empty_response");
  }

  return content.trim();
}
// ─── End 2Images-to-Video Amp ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputText = "";
  let mode: string | undefined;

  // Extract user ID from JWT token
  const userId = getUserIdFromRequest(req) || undefined;

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Allow": "POST, OPTIONS",
          },
        },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const text = (body?.text ?? "").toString();
    mode = typeof body?.mode === "string" ? (body.mode as string) : undefined;
    inputText = text;

    if (mode === "visual-ads") {
      const assetsCount = typeof body?.assets_count === "number"
        ? body.assets_count
        : Number(body?.assets_count ?? 0);
      const tagList = Array.isArray(body?.tag_list)
        ? body.tag_list.map((tag) => String(tag)).filter(Boolean)
        : [];
      const topicLabel = (body?.topic_label ?? "").toString();
      const topicPrompt = (body?.topic_prompt ?? "").toString();
      const ctaText = (body?.cta_text ?? "").toString();
      const styleLabel = (body?.style_label ?? "").toString();
      const stylePrompt = (body?.style_prompt ?? "").toString();
      const platform = (body?.platform ?? "9:16").toString();
      inputText = text;
      const responseLanguage = detectOutputLanguage(text);

      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'text' for visual-ads mode",
            code: "BAD_REQUEST_MISSING_TEXT",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const improved = await ampVisualAdsWithOpenAI(text, assetsCount, tagList, ctaText, topicLabel, topicPrompt, styleLabel, stylePrompt, platform);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "visual-ads",
          language: responseLanguage,
          assetsCount,
          tagList,
          topicLabel,
          topicPrompt,
          ctaText,
          styleLabel,
          stylePrompt,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: responseLanguage,
          mode: "visual-ads",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ─── Music/Lyrics Amp route (OpenAI gpt-4o-mini) ───
    if (mode === "music" || mode === "lyrics") {
      const durationSeconds = typeof body?.duration === "number" ? body.duration : 30;
      
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'text' for lyrics expansion",
            code: "BAD_REQUEST_MISSING_TEXT",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const improved = await ampMusicLyricsWithOpenAI(text, durationSeconds);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText: text,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "music-lyrics",
          duration: durationSeconds,
          language: hasArabic(text) ? "ar" : "en",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: hasArabic(text) ? "ar" : "en",
          mode: "music-lyrics",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // ─── End Music/Lyrics route ───

    // ─── Image-to-Video Amp route ───
    if (mode === "image2video") {
      const rawImageUrl = (body?.image_url ?? "").toString();
      const imageUrl = decodeURIComponent(rawImageUrl).trim();
      const brandDetails = (body?.brand_details ?? "").toString();
      const environment = (body?.environment ?? "").toString();
      const duration = (body?.duration ?? "6").toString();
      inputText = `[image2video] brand: ${brandDetails}, env: ${environment}, dur: ${duration}`;

      if (!imageUrl || imageUrl.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'image_url' for image2video mode",
            code: "BAD_REQUEST_MISSING_IMAGE",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const improved = await ampImage2VideoWithOpenAI(imageUrl, brandDetails, environment, duration);
      const responseLanguage = detectOutputLanguage(`${brandDetails} ${environment} ${improved}`);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "image2video",
          language: responseLanguage,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: responseLanguage,
          mode: "image2video",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // ─── End Image-to-Video route ───

    // ─── Text-to-Video Amp route (OpenAI gpt-4o-mini) ───
    if (mode === "text2video") {
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'text' for text2video mode",
            code: "BAD_REQUEST_MISSING_TEXT",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      inputText = `[text2video] ${text}`;
      const improved = await ampText2VideoWithOpenAI(text);
      const responseLanguage = detectOutputLanguage(text);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "text2video",
          language: responseLanguage,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: responseLanguage,
          mode: "text2video",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // ─── End Text-to-Video route ───

    // ─── 2Images-to-Video Amp route (OpenAI gpt-4o-mini vision with dual images) ───
    if (mode === "2images2video") {
      const rawImageUrl1 = (body?.image_url_1 ?? "").toString();
      const rawImageUrl2 = (body?.image_url_2 ?? "").toString();
      const imageUrl1 = decodeURIComponent(rawImageUrl1).trim();
      const imageUrl2 = decodeURIComponent(rawImageUrl2).trim();
      const userText = (body?.user_text ?? "").toString();
      const requestedDuration = (body?.duration ?? "").toString();
      const duration = ["6", "8"].includes(requestedDuration) ? requestedDuration : "8";
      const aspectRatio = (body?.aspect_ratio ?? "9:16").toString();
      
      inputText = `[2images2video] user: ${userText}, dur: ${duration}, ar: ${aspectRatio}`;

      if (!imageUrl1 || imageUrl1.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'image_url_1' for 2images2video mode",
            code: "BAD_REQUEST_MISSING_IMAGE1",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!imageUrl2 || imageUrl2.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: "Missing 'image_url_2' for 2images2video mode",
            code: "BAD_REQUEST_MISSING_IMAGE2",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const improved = await amp2Images2VideoWithOpenAI(imageUrl1, imageUrl2, userText, duration, aspectRatio);
      const responseLanguage = detectOutputLanguage(userText || improved);

      await logAI({
        functionName: "prompt-amp",
        userId,
        model: "gpt-4o-mini",
        inputText,
        outputText: improved,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: {
          provider: "openai",
          mode: "2images2video",
          language: responseLanguage,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: responseLanguage,
          mode: "2images2video",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // ─── End 2Images-to-Video route ───

    // ─── Bot Component Amp route ───
    if (mode === "bot-component") {
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Missing 'text'", code: "BAD_REQUEST_MISSING_TEXT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("CONFIG: Missing OPENAI_API_KEY");

      // Extract component name from prefix like "[Bot component: Ask Name] actual message"
      const componentMatch = text.match(/^\[Bot component:\s*([^\]]+)\]\s*/);
      const componentName = componentMatch ? componentMatch[1].trim() : "message";
      const rawMessage = componentMatch ? text.replace(componentMatch[0], "").trim() : text.trim();
      const isArabic = hasArabic(rawMessage);

      const systemPrompt = isArabic
        ? `أنت محرر نص محترف. مهمتك: صحح الإملاء والنحو واجعل الرسالة واضحة وودية ومختصرة. هذه رسالة بوت في مكوّن "${componentName}". أعد الرسالة المحسّنة فقط بدون شرح أو تعليق.`
        : `You are a professional text editor. Fix spelling, grammar, and make the message clear, friendly, and concise. This is a chatbot message for a "${componentName}" component. Return ONLY the improved message text, no explanation, no quotes.`;

      const payload = {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawMessage },
        ],
      };

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(`openai error: ${resp.status}`);

      const improved = data?.choices?.[0]?.message?.content?.trim() || rawMessage;

      await logAI({
        functionName: "prompt-amp", userId, model: "gpt-4o-mini",
        inputText: rawMessage, outputText: improved, durationMs: Date.now() - startTime,
        status: "success", metadata: { provider: "openai", mode: "bot-component", componentName },
      });

      return new Response(
        JSON.stringify({ success: true, text: improved, mode: "bot-component" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ─── End Bot Component route ───

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "Missing 'text'",
          code: "BAD_REQUEST_MISSING_TEXT",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const preferArabic = hasArabic(text);
    const improved = await ampPromptWithDeepSeek(text, preferArabic, mode);

    // Log successful AI usage with user ID
    await logAI({
      functionName: "prompt-amp",
      userId,
      model: "deepseek-chat",
      inputText: text,
      outputText: improved,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: {
        provider: "deepseek",
        mode: mode || "text2image",
        language: preferArabic ? "ar" : "en",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        text: improved,
        language: preferArabic ? "ar" : "en",
        mode: mode ?? null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Log error with user ID
    await logAI({
      functionName: "prompt-amp",
      userId,
      model: "deepseek-chat",
      inputText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: message,
      metadata: { provider: "deepseek", mode: mode || "text2image" },
    });

    return new Response(
      JSON.stringify({
        error: message,
        code: "UNHANDLED",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
