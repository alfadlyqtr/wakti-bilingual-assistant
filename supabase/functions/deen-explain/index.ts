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

type QuestionType = "reference_lookup" | "simple_evidence" | "fiqh_question" | "followup" | "sensitive" | "general_islamic";

type IntentMeta = {
  question_type?: QuestionType;
  normalized_topic?: string;
  likely_disputed?: boolean;
  needs_caution?: boolean;
  sufficient?: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decide whether this question needs Google Search grounding
// Fiqh and sensitive questions benefit most from authoritative scholarly sources
function needsGrounding(intent: IntentMeta, noLocalSources: boolean): boolean {
  const qType = intent.question_type ?? "general_islamic";
  return (
    noLocalSources ||
    qType === "fiqh_question" ||
    qType === "sensitive" ||
    (intent.likely_disputed ?? false)
  );
}

function buildPrompt(
  language: "ar" | "en",
  intent: IntentMeta,
  question: string,
  evidenceBlock: string,
  priorContext: string,
  useGrounding: boolean,
): string {
  const qType = intent.question_type ?? "general_islamic";
  const isDisputed = intent.likely_disputed ?? false;
  const needsCaution = intent.needs_caution ?? false;
  const sufficient = intent.sufficient ?? (evidenceBlock.length > 0);
  const topic = intent.normalized_topic ?? question;
  const noSources = evidenceBlock.length === 0 && !priorContext;
  const noNewSources = evidenceBlock.length === 0;

  const groundingInstruction = useGrounding
    ? (language === "ar"
        ? `استخدم بحث Google للعثور على فتاوى ومصادر موثوقة من: islamqa.info، islamweb.net، sunnah.com، dorar.net، alifta.gov.sa. `
        : `Use Google Search to find authoritative rulings from: islamqa.info, islamweb.net, sunnah.com, dorar.net, alifta.gov.sa. `)
    : "";

  let policy = "";

  if (language === "ar") {
    if (noSources && !noNewSources) {
      policy = `${groundingInstruction}لم تُعثر على مصادر في قاعدة البيانات المحلية. ${useGrounding ? "ابحث في الإنترنت عن أحاديث وفتاوى موثوقة لهذه المسألة." : "رُدّ بأسلوب محادثاتي دافئ، ولا تقدّم حكماً شرعياً دون دليل."}`;
    } else if (noNewSources) {
      policy = `${groundingInstruction}استخدم سياق المحادثة السابقة للرد بشكل طبيعي ومتصل.`;
    } else if ((qType === "fiqh_question" || qType === "sensitive") && !sufficient) {
      policy = `${groundingInstruction}هذا سؤال فقهي عن "${topic}". المصادر المحلية غير كافية. ${useGrounding ? "ابحث عن أحاديث وفتاوى علمية موثوقة لهذه المسألة تحديداً، واذكر مصادرها." : "وضّح ذلك بصراحة ودفء — لا تخترع حكماً — واذكر الخلاف العلمي."}`;
    } else if ((qType === "fiqh_question" || qType === "sensitive") && isDisputed) {
      policy = `${groundingInstruction}هذه مسألة "${topic}" خلافية. اعرض آراء المذاهب الأربعة إن أمكن، وأشر إلى الخلاف بوضوح، ولا تُجزم برأي واحد.`;
    } else if (qType === "fiqh_question" || qType === "sensitive") {
      policy = `${groundingInstruction}سؤال فقهي عن "${topic}". اشرح من المصادر المُقدَّمة${useGrounding ? " وادعمها بما تجده من مصادر موثوقة" : ""}. إذا كانت المسألة دقيقة، نوّه بذلك.`;
    } else if (qType === "followup") {
      policy = `${groundingInstruction}سؤال متابعة. حافظ على الموضوع وأجِب بأسلوب محادثاتي متصل.`;
    } else {
      policy = noSources
        ? `${groundingInstruction}${useGrounding ? "ابحث عن مصادر إسلامية موثوقة لهذا السؤال." : "رُدّ بأسلوب دافئ وبيّن غياب المصادر المباشرة."}`
        : `${groundingInstruction}اشرح من المصادر المُقدَّمة.`;
    }
    if (needsCaution) policy += " تنبّه: مسألة حساسة — لا تُصدر أحكاماً قاطعة.";

    const sourcesSection = evidenceBlock
      ? `\n\nالمصادر المسترجعة من قاعدة البيانات:\n${evidenceBlock}`
      : "";
    const priorSection = priorContext
      ? `\n\nسياق المحادثة السابقة:\n${priorContext}`
      : "";

    return `أنت مساعد إسلامي محادثاتي في تطبيق Wakti. تحدّث بأسلوب طبيعي ودافئ كصديق عالم. ${policy}

قدّم إجابة شاملة ومفيدة، واذكر الأحاديث والآيات ذات الصلة. إذا كانت المسألة فيها خلاف بين الفقهاء، اشرح آراء المذاهب المختلفة.

مهم جداً: اكتب النص العادي فقط. لا تستخدم أي رموز markdown مثل ## أو ** أو * أو - في بداية السطر. اكتب بأسلوب محادثة طبيعية مع فقرات منفصلة بسطر فارغ.

أخرج JSON فقط بدون أي نص خارجه:
{"summary":"إجابة شاملة ومفيدة هنا...","quran_summary":"","hadith_summary":""}

السؤال: ${question}${priorSection}${sourcesSection}`;
  }

  // English
  if (noSources && !noNewSources) {
    policy = `${groundingInstruction}No sources in local DB. ${useGrounding ? "Search the web for authentic hadiths and scholarly rulings on this topic." : "Respond warmly without inventing rulings."}`;
  } else if (noNewSources) {
    policy = `${groundingInstruction}Use prior conversation context to respond naturally.`;
  } else if ((qType === "fiqh_question" || qType === "sensitive") && !sufficient) {
    policy = `${groundingInstruction}Fiqh question about "${topic}". Local sources insufficient. ${useGrounding ? "Search for authentic hadiths and scholarly fatwas on this specific issue from trusted sites." : "Be honest about insufficient evidence, mention scholarly disagreement, recommend consulting a scholar."}`;
  } else if ((qType === "fiqh_question" || qType === "sensitive") && isDisputed) {
    policy = `${groundingInstruction}Disputed fiqh question about "${topic}". Present views of the four madhabs if possible. Acknowledge scholarly disagreement clearly — do NOT present one view as the only answer.`;
  } else if (qType === "fiqh_question" || qType === "sensitive") {
    policy = `${groundingInstruction}Fiqh question about "${topic}". Explain from provided sources${useGrounding ? " and supplement with trusted scholarly sources found via search" : ""}. Note any nuances.`;
  } else if (qType === "followup") {
    policy = `${groundingInstruction}Follow-up question. Stay on topic and respond conversationally.`;
  } else {
    policy = noSources
      ? `${groundingInstruction}${useGrounding ? "Search for authoritative Islamic sources for this question." : "Respond conversationally, honest about lack of direct sources."}`
      : `${groundingInstruction}Explain from provided sources.`;
  }
  if (needsCaution) policy += " Sensitive topic — avoid definitive rulings.";

  const sourcesSection = evidenceBlock
    ? `\n\nSources from local database:\n${evidenceBlock}`
    : "";
  const priorSection = priorContext
    ? `\n\nPrior conversation context:\n${priorContext}`
    : "";

  return `You are Wakti's Islamic conversational assistant. Speak naturally and warmly, like a knowledgeable friend. ${policy}

Give a thorough, helpful answer. Cite Hadiths and Quran verses. If this is a fiqh matter with scholarly disagreement, explain the different scholarly positions.

IMPORTANT: Write in plain conversational prose only. Do NOT use any markdown symbols such as ##, **, *, or - at the start of lines. Use natural paragraphs separated by blank lines instead of bullet points or headers.

Output ONLY valid JSON with no text outside it:
{"summary":"your full helpful answer here...","quran_summary":"","hadith_summary":""}

Question: ${question}${priorSection}${sourcesSection}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "missing_gemini_key" }, 500);

    const body = await req.json().catch(() => ({}));
    const language: "ar" | "en" = body?.language === "ar" ? "ar" : "en";
    const question = String(body?.question ?? "").trim();
    if (!question) return json({ error: "missing_question" }, 400);

    const quranResults = Array.isArray(body?.quran_results) ? body.quran_results as SourceResult[] : [];
    const hadithResults = Array.isArray(body?.hadith_results) ? body.hadith_results as SourceResult[] : [];
    const allSources = [...quranResults, ...hadithResults];
    const priorContext = typeof body?.prior_context === "string" ? body.prior_context.trim() : "";
    const intentTopic = typeof body?.intent_topic === "string" ? body.intent_topic.trim() : "";

    const intentMeta: IntentMeta = {
      question_type: body?.intent?.question_type ?? body?.question_type ?? undefined,
      normalized_topic: body?.intent?.normalized_topic ?? (intentTopic || undefined),
      likely_disputed: body?.intent?.likely_disputed ?? false,
      needs_caution: body?.intent?.needs_caution ?? false,
      sufficient: body?.meta?.sufficient ?? (allSources.length > 0),
    };

    const evidenceBlock = allSources.length > 0
      ? allSources.slice(0, 6).map((item, index) => {
          const text = item.english_text || item.translation || item.arabic_text || item.text || "";
          const trimmed = text.length > 400 ? text.slice(0, 400) + "…" : text;
          return `[${index + 1}] ${item.source_type.toUpperCase()} — ${item.reference}${item.grade ? ` (${item.grade})` : ""}:\n${trimmed}`;
        }).join("\n\n")
      : "";

    const useGrounding = needsGrounding(intentMeta, allSources.length === 0);
    const prompt = buildPrompt(language, intentMeta, question, evidenceBlock, priorContext, useGrounding);

    // Build Gemini request with optional Google Search grounding
    // NOTE: responseMimeType cannot be used together with googleSearch tools
    const geminiBody: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
        ...(useGrounding ? {} : { responseMimeType: "application/json" }),
      },
    };

    if (useGrounding) {
      geminiBody.tools = [{ googleSearch: {} }];
    }

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      },
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`gemini_failed:${geminiResp.status}:${errText.slice(0, 300)}`);
    }

    const payload = await geminiResp.json();

    // Collect all text parts (grounding may split across multiple parts)
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const rawText = parts.map((p: { text?: string }) => p.text ?? "").join("") || "{}";

    // Strip markdown fences and extract JSON
    const fenceStripped = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Try to find JSON object if Gemini added prose before/after
    const jsonMatch = fenceStripped.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : fenceStripped;

    let parsed: { summary?: string; quran_summary?: string; hadith_summary?: string } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Gemini returned plain prose — use it as summary
      parsed = { summary: fenceStripped, quran_summary: "", hadith_summary: "" };
    }

    // Strip any residual markdown Gemini slips in despite instructions
    const rawSummary = parsed?.summary ?? "";
    const summary = rawSummary
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^[\*\-]\s+/gm, "")
      .trim();
    const quranSummary = parsed?.quran_summary ?? "";
    const hadithSummary = parsed?.hadith_summary ?? "";

    await logAIFromRequest(req, {
      functionName: "deen-explain",
      provider: "google",
      model: "gemini-2.0-flash",
      inputText: question,
      outputText: summary,
      status: "success",
      metadata: {
        source_count: allSources.length,
        question_type: intentMeta.question_type,
        likely_disputed: intentMeta.likely_disputed,
        sufficient: intentMeta.sufficient,
        grounding_used: useGrounding,
      },
    });

    return json({ summary, quran_summary: quranSummary, hadith_summary: hadithSummary });

  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-explain",
      provider: "google",
      model: "gemini-2.0-flash",
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error("[deen-explain]", error);
    return json({ error: "internal_error" }, 500);
  }
});
