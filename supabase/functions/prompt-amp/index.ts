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

  if (preferArabic) {
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
