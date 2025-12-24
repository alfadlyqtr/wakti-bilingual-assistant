// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

async function logAIFromRequest(req: Request, params: {
  functionName: string;
  provider: string;
  model: string;
  inputText?: string;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let userId: string | null = null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1] || ""));
        userId = payload?.sub || null;
      } catch {
        userId = null;
      }
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/ai_usage_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRole,
        "Authorization": `Bearer ${serviceRole}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        function_name: params.functionName,
        provider: params.provider,
        model: params.model,
        status: params.status,
        input_text: params.inputText || null,
        input_tokens: estimateTokens(params.inputText),
        error_message: params.errorMessage || null,
        metadata: params.metadata || null,
      }),
    });

    if (!res.ok) {
      await res.text();
    }
  } catch {
    // ignore
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Language = "en" | "ar";

type Field = "title" | "subtitle" | "bullet";

interface RequestBody {
  topic: string;
  slideNumber: number;
  slideCount: number;
  language: Language;
  objective: string;
  audience: string;
  scenario: string;
  tone: string;

  field: Field;
  currentText: string;

  currentTitle?: string;
  currentSubtitle?: string;
  currentBullets?: string[];
  bulletIndex?: number;
}

async function callGemini(prompt: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 240,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", text);
    throw new Error("Gemini API error: " + res.status);
  }

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("No response from Gemini");
  return responseText;
}

function buildPrompt(body: RequestBody): string {
  const baseContext = body.language === "ar"
    ? `أنت مساعد لتحسين سطر واحد فقط داخل شريحة عرض تقديمي. المطلوب إعادة صياغة السطر مع الحفاظ على نفس المعنى (بدون إضافة أفكار جديدة).\n\nالسياق (من قوائم العرض):\n- الموضوع: ${body.topic}\n- الهدف: ${body.objective}\n- الجمهور: ${body.audience}\n- السيناريو: ${body.scenario}\n- النبرة: ${body.tone}\n\nهذه هي الشريحة رقم ${body.slideNumber} من أصل ${body.slideCount}.`
    : `You rewrite ONLY ONE line inside a presentation slide. You must keep the SAME meaning (no new ideas).\n\nPresentation dropdown context:\n- Topic: ${body.topic}\n- Objective: ${body.objective}\n- Audience: ${body.audience}\n- Scenario: ${body.scenario}\n- Tone: ${body.tone}\n\nThis is slide ${body.slideNumber} of ${body.slideCount}.`;

  const fieldLabel = body.language === "ar"
    ? (body.field === "title" ? "العنوان" : body.field === "subtitle" ? "العنوان الفرعي" : "نقطة")
    : (body.field === "title" ? "title" : body.field === "subtitle" ? "subtitle" : "bullet");

  const slideContext = body.language === "ar"
    ? `\n\nمحتوى الشريحة الحالي (للسياق فقط):\n- العنوان: ${body.currentTitle || ""}\n- العنوان الفرعي: ${body.currentSubtitle || ""}\n- النقاط: ${(body.currentBullets || []).join(" | ")}`
    : `\n\nCurrent slide content (context only):\n- Title: ${body.currentTitle || ""}\n- Subtitle: ${body.currentSubtitle || ""}\n- Bullets: ${(body.currentBullets || []).join(" | ")}`;

  const instruction = body.language === "ar"
    ? `\n\nأعد JSON صالح فقط بالشكل التالي (بدون أي نص إضافي):\n{\n  "text": "..."\n}\n\nقواعد صارمة:\n- أعد صياغة ${fieldLabel} فقط\n- حافظ على نفس المعنى تماماً\n- لا تضف معلومات جديدة\n- اجعلها قصيرة ومناسبة للعرض (سطر واحد إن أمكن)\n- لا تضف علامات اقتباس خارج JSON`
    : `\n\nReturn valid JSON only (no extra text):\n{\n  "text": "..."\n}\n\nStrict rules:\n- Rewrite the ${fieldLabel} only\n- Keep the exact meaning (no new info)\n- Keep it concise and slide-ready (ideally one line)\n- No extra quotes outside JSON`;

  const target = body.language === "ar"
    ? `\n\nالنص الحالي المطلوب إعادة صياغته: ${body.currentText}`
    : `\n\nCurrent text to rewrite: ${body.currentText}`;

  return `${baseContext}${slideContext}${target}${instruction}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as RequestBody;

    if (!body.topic?.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.field || !["title", "subtitle", "bullet"].includes(body.field)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.currentText?.trim()) {
      return new Response(JSON.stringify({ success: false, error: "currentText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(body);
    const raw = await callGemini(prompt);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Failed to parse Gemini response as JSON");
      parsed = JSON.parse(match[0]);
    }

    const text = String(parsed?.text || "").trim();
    if (!text) {
      throw new Error("Empty rewritten text");
    }

    await logAIFromRequest(req, {
      functionName: "wakti-presentation-regenerate-field",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      inputText: body.currentText,
      status: "success",
      metadata: { field: body.field, slideNumber: body.slideNumber, slideCount: body.slideCount },
    });

    return new Response(JSON.stringify({ success: true, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);

    await logAIFromRequest(req, {
      functionName: "wakti-presentation-regenerate-field",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
