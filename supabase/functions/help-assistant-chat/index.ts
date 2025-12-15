import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type IncomingHistoryMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type RequestBody = {
  message?: string;
  language?: string;
  history?: IncomingHistoryMessage[];
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const WAKTI_ONLY_SYSTEM_EN =
  "You are WAKTI Help Assistant. You ONLY answer questions about using the WAKTI app (features, buttons, where to find things, step-by-step instructions). If the user asks anything not related to WAKTI, you must refuse briefly and ask them to ask about WAKTI. Keep answers practical and step-by-step.";

const WAKTI_ONLY_SYSTEM_AR =
  "أنت مساعد WAKTI للمساعدة داخل التطبيق. تجيب فقط عن أسئلة استخدام تطبيق WAKTI (الميزات، الأزرار، أين تجد الأشياء، خطوات واضحة). إذا كان السؤال ليس عن WAKTI، ارفض باختصار واطلب من المستخدم أن يسأل عن WAKTI. اجعل الإجابات عملية وبخطوات.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    if (!DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch (_e) {
      void _e;
      body = {};
    }

    const message = String(body?.message || "").trim();
    const language = (body?.language === "ar" ? "ar" : "en") as "ar" | "en";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = language === "ar" ? WAKTI_ONLY_SYSTEM_AR : WAKTI_ONLY_SYSTEM_EN;

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    for (const m of history.slice(-10)) {
      const role = m?.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content ?? "").trim();
      if (!content) continue;
      messages.push({ role, content });
    }

    messages.push({ role: "user", content: message });

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    const durationMs = Date.now() - start;
    const raw = await resp.text();

    if (!resp.ok) {
      await logAIFromRequest(req, {
        functionName: "help-assistant-chat",
        provider: "deepseek",
        model: "deepseek-chat",
        inputText: message,
        outputText: raw,
        durationMs,
        status: "error",
        errorMessage: `DeepSeek HTTP ${resp.status}`,
      });

      return new Response(
        JSON.stringify({ error: "DeepSeek error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let json: unknown = {};
    try {
      json = JSON.parse(raw) as unknown;
    } catch (_e) {
      void _e;
      json = {} as unknown;
    }

    const reply = String(
      (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? ""
    ).trim();

    await logAIFromRequest(req, {
      functionName: "help-assistant-chat",
      provider: "deepseek",
      model: "deepseek-chat",
      inputText: message,
      outputText: reply,
      durationMs,
      status: "success",
    });

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const durationMs = Date.now() - start;

    try {
      await logAIFromRequest(req, {
        functionName: "help-assistant-chat",
        provider: "deepseek",
        model: "deepseek-chat",
        durationMs,
        status: "error",
        errorMessage: String((e as { message?: string })?.message || e || "Unknown error"),
      });
    } catch (_e) {
      void _e;
    }

    return new Response(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
