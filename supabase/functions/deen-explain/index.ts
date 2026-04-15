import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type SourceResult = {
  source_type: "quran" | "hadith";
  reference: string;
  title?: string;
  text?: string;
  translation?: string;
  arabic_text?: string;
  english_text?: string;
  grade?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return json({ error: "missing_openai_key" }, 500);

    const body = await req.json().catch(() => ({}));
    const language: "ar" | "en" = body?.language === "ar" ? "ar" : "en";
    const question = String(body?.question ?? "").trim();
    const quranResults = Array.isArray(body?.quran_results) ? body.quran_results as SourceResult[] : [];
    const hadithResults = Array.isArray(body?.hadith_results) ? body.hadith_results as SourceResult[] : [];
    const allSources = [...quranResults, ...hadithResults];
    const priorContext = typeof body?.prior_context === "string" ? body.prior_context.trim() : "";

    if (!question) return json({ error: "missing_question" }, 400);
    if (allSources.length === 0 && !priorContext) return json({ error: "missing_sources" }, 400);

    const evidenceBlock = allSources.length > 0
      ? allSources.slice(0, 4).map((item, index) => {
          const text = item.english_text || item.translation || item.arabic_text || item.text || "";
          const trimmed = text.length > 300 ? text.slice(0, 300) + "…" : text;
          return `[${index + 1}] ${item.source_type.toUpperCase()} ${item.reference}${item.grade ? ` (${item.grade})` : ""}: ${trimmed}`;
        }).join("\n")
      : "";

    const noNewSources = allSources.length === 0;

    const system = language === "ar"
      ? `أنت مساعد إسلامي محادثاتي في Wakti. تحدّث بأسلوب طبيعي ودافئ. ${noNewSources ? "لم تُعثر على آيات أو أحاديث جديدة لهذا السؤال، لكن لديك سياق المحادثة السابقة. استخدمه للرد بشكل طبيعي ومتصل، ووضّح أنك لم تجد مصادر جديدة لهذا التحديد لكنك تجيب بناءً على ما سبق." : "اشرح فقط من المصادر المعطاة. لا تضف أي معرفة خارجية، ولا تخترع أدلة."} أخرج JSON فقط بهذا الشكل: {"summary":"...","quran_summary":"...","hadith_summary":"..."}.`
      : `You are Wakti's Islamic conversational assistant. Speak naturally and warmly. ${noNewSources ? "No new Quran or Hadith sources were found for this specific question, but you have prior conversation context. Use it to respond naturally and in a connected way — acknowledge you didn't find new sources for this specific point, but engage with it based on what was already discussed." : "Explain only from the provided sources below. Do not add outside knowledge, do not invent evidence."} Output JSON only in this shape: {"summary":"...","quran_summary":"...","hadith_summary":"..."}.`;

    const priorBlock = priorContext
      ? `\n\n${language === "ar" ? "سياق المحادثة السابقة" : "Prior conversation context"}:\n${priorContext}`
      : "";

    const sourcesBlock = evidenceBlock
      ? `\n\n${language === "ar" ? "المصادر المسترجعة" : "Retrieved sources"}:\n${evidenceBlock}`
      : "";

    const userPrompt = `${language === "ar" ? "السؤال" : "Question"}: ${question}${priorBlock}${sourcesBlock}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`openai_failed:${resp.status}:${errText}`);
    }

    const payload = await resp.json();
    const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");

    await logAIFromRequest(req, {
      functionName: "deen-explain",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: userPrompt,
      outputText: parsed?.summary ?? "",
      status: "success",
      metadata: { source_count: allSources.length },
    });

    return json({
      summary: parsed?.summary ?? "",
      quran_summary: parsed?.quran_summary ?? "",
      hadith_summary: parsed?.hadith_summary ?? "",
    });
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-explain",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error("[deen-explain]", error);
    return json({ error: "internal_error" }, 500);
  }
});
