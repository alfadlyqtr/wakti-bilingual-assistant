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

function buildSystemPrompt(preferArabic: boolean, mode?: string) {
  const isI2I = mode === "image2image";
  const isBG = mode === "background-removal";
  const isMusic = mode === "music";
  const isLyrics = mode === "lyrics";

  const isText2Video = mode === "text2video";

  if (preferArabic) {
    if (isText2Video) {
      return [
        "أنت مهندس مطالبات خبير لنماذج تحويل النص إلى فيديو.",
        "مهمتك: أعد صياغة فكرة المستخدم كمطالبة فيديو سينمائية واحدة باللغة الإنجليزية.",
        "قواعد صارمة:",
        "- يجب أن يكون الناتج باللغة الإنجليزية دائماً حتى لو كان الإدخال بالعربية.",
        "- صف الحركة والمشهد والكاميرا والإضاءة والمزاج بوضوح.",
        "- اجعل الوصف حيوياً ومفصلاً لنموذج إنشاء الفيديو.",
        "- لا تتحدث مع المستخدم، لا تشرح، فقط أخرج المطالبة المحسّنة.",
        "المخرج: فقرة واحدة باللغة الإنجليزية تصف الفيديو المطلوب."
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
        "You are an expert prompt engineer for Text-to-Video AI models.",
        "Your job: rewrite the user's idea into a single, vivid, cinematic video prompt.",
        "Hard rules:",
        "- Output must ALWAYS be in English, even if the input is in another language.",
        "- Describe the scene, motion, camera movement, lighting, mood, and timing clearly.",
        "- Be specific about subjects, environments, actions, and visual dynamics.",
        "- Keep the prompt under 300 words but rich in detail.",
        "- Do NOT chat, explain, or add commentary. Output only the enhanced video prompt.",
        "Output format: One paragraph describing the desired video scene and motion."
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

async function ampPromptWithDeepSeek(
  input: string,
  preferArabic: boolean,
  mode?: string
) {
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
function stripArabicChars(text: string): string {
  return (text || "")
    .replace(/[\u0600-\u06FF]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const IMAGE2VIDEO_SYSTEM_PROMPT = `You are a cinematic video prompt engineer. You analyze an uploaded image and generate a production-ready video prompt for a 6–10 second cinematic reveal spot.

Your job:
1. Analyze the uploaded image: colors, shapes, style, aesthetic cues, product/category hints, visible text/symbols.
2. Combine image analysis with any brand details and environment provided by the user.
3. Output ONLY a pure JSON block using exactly these keys:

{
  "description": "A vivid one-sentence cinematic synopsis of the full transformation (under 120 words)",
  "style": "comma-separated visual aesthetics inferred from the image (e.g., cinematic, colourful, high-tech, 4K)",
  "camera": "one line describing the shot type and camera movement",
  "lighting": "one line describing the lighting progression",
  "environment": "concise description of the starting environment",
  "elements": ["ordered list of visible props and inferred hero items"],
  "motion": "one line describing how objects assemble or unfold",
  "ending": "one line describing the final cinematic tableau",
  "text": "none",
  "keywords": ["9:16", "<derived-brand-name>", "fast assembly", "no text", "cinematic", "...additional inferred tags"]
}

Rules:
- Output language MUST be ENGLISH ONLY. If any provided brand/business details are in Arabic (or any non-English language), translate them internally and output ONLY English.
- Write in present tense, active voice.
- Keep description under ~120 words.
- One seamless, visually satisfying build-up from emptiness to full reveal.
- Keep the hero item visible throughout, or at minimum at start and end.
- Decide props, mood, pacing, and any people or animals independently based on image style and brand details.
- If brand direction is unclear, default to cinematic magical realism.
- The aspect ratio is ALWAYS 9:16 (vertical/portrait).
- Output ONLY the JSON block. No preamble, no explanation, no follow-up.`;

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
            image_url: { url: imageUrl.trim(), detail: "low" },
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

  // Parse the JSON to extract a flat prompt string for the video model
  try {
    // Strip markdown code fences if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(jsonStr);

    // Build a single descriptive prompt from the JSON fields
    const parts: string[] = [];
    if (parsed.description) parts.push(parsed.description);
    if (parsed.style) parts.push(`Style: ${parsed.style}.`);
    if (parsed.camera) parts.push(`Camera: ${parsed.camera}.`);
    if (parsed.lighting) parts.push(`Lighting: ${parsed.lighting}.`);
    if (parsed.environment) parts.push(`Environment: ${parsed.environment}.`);
    if (Array.isArray(parsed.elements) && parsed.elements.length > 0) {
      parts.push(`Elements: ${parsed.elements.join(", ")}.`);
    }
    if (parsed.motion) parts.push(`Motion: ${parsed.motion}.`);
    if (parsed.ending) parts.push(`Ending: ${parsed.ending}.`);
    if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
      parts.push(`Keywords: ${parsed.keywords.join(", ")}.`);
    }

    return stripArabicChars(parts.join(" "));
  } catch {
    // If JSON parsing fails, return the raw content as-is (still useful)
    return stripArabicChars(content.trim());
  }
}
// ─── End Image-to-Video Amp ───

// ─── Text-to-Video Amp (OpenAI gpt-4o-mini) ───
const TEXT2VIDEO_SYSTEM_PROMPT = `You are an expert cinematic video prompt engineer for Text-to-Video AI models.

Your job: Take the user's idea (in ANY language, including Arabic) and rewrite it as a single, vivid, production-ready cinematic video prompt in ENGLISH.

The video prompt should describe a 6–10 second cinematic spot. Think of brands like Corona, Tesla, IKEA, Apple, Google, Qatar Airways, and Chewy — magical, fast-assembly transformations progressing smoothly from an empty or minimal scene into a fully revealed experience. No on-screen text. No spoken dialogue.

Rules & Tone:
- Output must ALWAYS be in English, even if the input is in Arabic or another language.
- Write in present tense, active voice.
- Keep the description under ~200 words but rich in cinematic detail.
- Describe the scene, motion, camera movement, lighting progression, mood, environment, and timing clearly.
- Ensure one seamless, visually satisfying build-up or transformation.
- Be specific about subjects, environments, actions, visual dynamics, and pacing.
- If brand/product direction is unclear, default to cinematic magical realism.
- Do NOT chat, explain, ask questions, or add commentary. Output ONLY the enhanced video prompt.
- Do NOT include any JSON formatting. Output a single plain-text paragraph.

Output format: One vivid paragraph describing the desired video scene, motion, camera work, lighting, and mood.`;

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

    // ─── Image-to-Video Amp route ───
    if (mode === "image2video") {
      const imageUrl = (body?.image_url ?? "").toString().trim();
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
          language: "en",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: "en",
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
          language: "en",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          text: improved,
          language: "en",
          mode: "text2video",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // ─── End Text-to-Video route ───

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
