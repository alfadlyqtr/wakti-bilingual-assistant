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

function hasFollowupCue(text: string): boolean {
  return /\?(?:\s|$)|؟(?:\s|$)/.test(text);
}

function looksEmotional(text: string): boolean {
  return /(sad|depressed|anxious|anxiety|worried|grief|grieving|stress|stressed|distress|afraid|fear|lonely|overwhelmed|tired|hopeless|cry|crying|depress|upset|pain|hurting|heartbroken|repent|tawbah|forgive me|forgiveness|lazy|laziness|don.t feel like|dont feel like|no motivation|lost|spiritually|low iman|weak iman|missing prayer|missed prayer|overslept|can.t pray|cant pray|struggling|numb|disconnected|far from allah|far from god)/i.test(text)
    || /(حزين|مكتئب|مهموم|قلق|خوف|خائف|أبكي|ضيق|كرب|متعب|مرهق|توبة|استغفار|أشعر بالسوء|منكسر|كسل|لا أشعر|فقدت|ضعيف الإيمان|بعيد عن الله)/.test(text);
}

function looksLikeSpiritual(text: string): boolean {
  return /(lazy|laziness|don.t feel like praying|dont feel like praying|no motivation to pray|low iman|weak iman|spiritually (dead|numb|lost|weak|empty)|disconnected from allah|far from allah|can.t bring myself to pray|struggling with (prayer|salah|worship)|lost my connection)/i.test(text)
    || /(كسل|لا أشعر بالرغبة في الصلاة|ضعيف الإيمان|بعيد عن الله|لا أجد دافعاً للصلاة)/.test(text);
}

function buildFollowup(language: "ar" | "en", question: string, intent: IntentMeta): string {
  const qType = intent.question_type ?? "general_islamic";
  const topic = (intent.normalized_topic ?? question).toLowerCase();
  const emotional = looksEmotional(question) || looksEmotional(topic);

  if (language === "ar") {
    const spiritual = looksLikeSpiritual(question) || looksLikeSpiritual(topic);
    if (spiritual) return "هل تريد دعاءً قصيراً يساعدك على تليين القلب والرجوع إلى الصلاة؟";
    if (emotional) return "هل تريد أن أجهز لك دعاءً قصيراً يقال في مثل هذا الحال؟";
    if (qType === "reference_lookup") return "هل تريد أن أعرض لك المعنى باختصار أيضاً؟";
    if (qType === "followup") return "هل تريد أن أكمل معك على نفس الموضوع باختصار؟";
    if (qType === "fiqh_question" || qType === "sensitive") return "هل تريد أن ألخص لك الأدلة باختصار شديد؟";
    if (/dua|دعاء|supplication/.test(topic)) return "هل تريد دعاءً قصيراً من القرآن أو السنة في هذا المعنى؟";
    if (/patience|sabr|الصبر/.test(topic)) return "هل تريد آيتين قصيرتين عن الصبر؟";
    return "هل تريد آية أو حديثاً إضافياً عن هذا الموضوع؟";
  }

  const spiritual = looksLikeSpiritual(question) || looksLikeSpiritual(topic);
  if (spiritual) return "Do you want a short dua to help soften the heart and come back to prayer?";
  if (emotional) return "Do you want a short dua for this situation?";
  if (qType === "reference_lookup") return "Do you want me to also give you the meaning in a simple way?";
  if (qType === "followup") return "Do you want me to continue with the same topic briefly?";
  if (qType === "fiqh_question" || qType === "sensitive") return "Do you want me to summarise the evidence briefly as well?";
  if (/dua|supplication|دعاء/.test(topic)) return "Do you want a short dua from the Quran or Sunnah about this?";
  if (/patience|sabr|الصبر/.test(topic)) return "Do you want two short Quran verses about patience?";
  return "Do you want one more verse or hadith about this topic?";
}

function ensureFollowup(summary: string, language: "ar" | "en", question: string, intent: IntentMeta): string {
  const clean = summary.trim();
  if (!clean) return buildFollowup(language, question, intent);
  if (hasFollowupCue(clean)) return clean;
  return `${clean}\n\n${buildFollowup(language, question, intent)}`;
}

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

function isDuaRequest(question: string): boolean {
  return /(give me a dua|prepare a dua|dua please|short dua|more duas|few duas|yes please|a dua|another dua|can i have a dua|أعطني دعاء|هات دعاء|دعاء قصير|أريد دعاء|نعم من فضلك|أعطني أدعية|المزيد من الأدعية)/i.test(question);
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
  const duaMode = isDuaRequest(question);

  const groundingInstruction = useGrounding
    ? (language === "ar"
        ? `استخدم بحث Google للعثور على فتاوى ومصادر موثوقة من: islamqa.info، islamweb.net، sunnah.com، dorar.net، alifta.gov.sa. `
        : `Use Google Search to find authoritative rulings from: islamqa.info, islamweb.net, sunnah.com, dorar.net, alifta.gov.sa. `)
    : "";

  const sourcesSection = evidenceBlock
    ? (language === "ar" ? `\n\nالمصادر المسترجعة من قاعدة البيانات:\n${evidenceBlock}` : `\n\nSources from local database:\n${evidenceBlock}`)
    : "";
  const priorSection = priorContext
    ? (language === "ar" ? `\n\nسياق المحادثة السابقة:\n${priorContext}` : `\n\nPrior conversation context:\n${priorContext}`)
    : "";

  if (language === "ar") {
    let policy = "";
    if (duaMode) {
      policy = `المستخدم يطلب دعاءً بشكل مباشر. قدّم 2 إلى 3 أدعية قصيرة ذات صلة بالموضوع من سياق المحادثة السابقة. لكل دعاء: النص العربي، ثم المعنى بالعربية، ثم المصدر (قرآن أو حديث صحيح). أضف كلمة تشجيعية قصيرة في البداية. لا تعطِ محاضرة.`;
    } else if (noNewSources && priorContext) {
      policy = `${groundingInstruction}سؤال متابعة. ابقَ على نفس الموضوع من المحادثة السابقة. أجِب بأسلوب محادثاتي دافئ ومتصل. لا تبدأ موضوعاً جديداً.`;
    } else if ((qType === "fiqh_question" || qType === "sensitive") && isDisputed) {
      policy = `${groundingInstruction}مسألة "${topic}" خلافية. اعرض آراء العلماء من المصادر المُقدَّمة، وأشر إلى الخلاف بوضوح، ولا تُجزم برأي واحد.`;
    } else if ((qType === "fiqh_question" || qType === "sensitive") && !sufficient) {
      policy = `${groundingInstruction}سؤال فقهي عن "${topic}". ${useGrounding ? "ابحث عن فتاوى موثوقة لهذه المسألة." : "أجب بصدق مع ذكر الخلاف العلمي إن وجد."}`;
    } else if (qType === "fiqh_question" || qType === "sensitive") {
      policy = `${groundingInstruction}سؤال فقهي عن "${topic}". اشرح من المصادر المُقدَّمة${useGrounding ? " وادعمها بما تجده من مصادر موثوقة" : ""}. إذا كانت المسألة دقيقة، نوّه بذلك.`;
    } else if (qType === "followup") {
      policy = `${groundingInstruction}سؤال متابعة. حافظ على الموضوع تماماً من سياق المحادثة السابقة. لا تغيّر الموضوع.`;
    } else {
      policy = noSources
        ? `${groundingInstruction}${useGrounding ? "ابحث عن مصادر إسلامية موثوقة لهذا السؤال." : "رُدّ بأسلوب دافئ مع ذكر آيات أو أحاديث ذات صلة."}`
        : `${groundingInstruction}اشرح من المصادر المُقدَّمة مع ذكر النصوص مباشرة.`;
    }
    if (needsCaution && !duaMode) policy += " تنبّه: مسألة حساسة — لا تُصدر أحكاماً قاطعة.";

    return `أنت مساعد إسلامي في تطبيق Wakti — رفيق ذكي ودافئ يجمع بين العلم الشرعي والتعاطف الإنساني. ${policy}

اتبع هذا الترتيب في إجابتك:
1. إذا كان السؤال شخصياً أو عاطفياً: ابدأ بجملة تعاطف قصيرة وصادقة.
2. قدّم نصيحة عملية مختصرة مرتبطة بالموضوع (مثل: كيف تحافظ على الصلاة، ماذا تفعل بعد نسيانها، إلخ).
3. ادعم كلامك بآية أو حديث نبوي صحيح مع ذكر المصدر.
4. اختتم بسؤال متابعة واحد لطيف (مثل: هل تريد دعاءً مناسباً لهذا الحال؟).

قواعد أخرى:
- إذا طُلب منك دعاء: قدّمه مباشرة مع النص العربي والمعنى والمصدر.
- إذا وعدت بشيء في المحادثة السابقة، نفّذه مباشرة ولا تسأل مجدداً.
- لا تكرّر ما قيل من قبل — تابع من حيث توقفت.

مهم جداً: اكتب النص العادي فقط. لا تستخدم أي رموز markdown مثل ## أو ** أو * أو - في بداية السطر. اكتب بأسلوب محادثة طبيعية مع فقرات منفصلة بسطر فارغ.

أخرج JSON فقط بدون أي نص خارجه:
{"summary":"إجابة شاملة ومفيدة هنا...","quran_summary":"","hadith_summary":""}

السؤال: ${question}${priorSection}${sourcesSection}`;
  }

  // English
  let policy = "";
  if (duaMode) {
    policy = `The user explicitly asked for duas. Deliver 2 to 3 short relevant duas based on the topic from prior conversation context. For each dua: transliteration, then meaning in English, then the source (Quran or authentic Hadith). Mention the Arabic text only if it is short and well-known. Add one short warm encouraging line at the start. Do NOT lecture.`;
  } else if (noNewSources && priorContext) {
    policy = `${groundingInstruction}Follow-up question. Stay on exactly the same topic from the prior conversation. Do NOT change topic. Respond naturally and conversationally.`;
  } else if ((qType === "fiqh_question" || qType === "sensitive") && isDisputed) {
    policy = `${groundingInstruction}Disputed fiqh question about "${topic}". Present scholarly views from provided sources. Acknowledge disagreement clearly — do NOT present one view as the only answer.`;
  } else if ((qType === "fiqh_question" || qType === "sensitive") && !sufficient) {
    policy = `${groundingInstruction}Fiqh question about "${topic}". ${useGrounding ? "Search for authentic hadiths and scholarly fatwas on this specific issue." : "Be honest about insufficient evidence, mention scholarly disagreement."}`;
  } else if (qType === "fiqh_question" || qType === "sensitive") {
    policy = `${groundingInstruction}Fiqh question about "${topic}". Explain from provided sources${useGrounding ? " and supplement with trusted scholarly sources" : ""}. Note nuances.`;
  } else if (qType === "followup") {
    policy = `${groundingInstruction}Follow-up question. Stay on the exact same topic from prior conversation context. Do NOT change topic.`;
  } else {
    policy = noSources
      ? `${groundingInstruction}${useGrounding ? "Search for authoritative Islamic sources for this question." : "Answer from your knowledge of authentic Quran and Hadith, cite the source for every claim."}`
      : `${groundingInstruction}Explain from provided sources, quote the texts directly.`;
  }
  if (needsCaution && !duaMode) policy += " Sensitive topic — avoid definitive rulings.";

  return `You are Wakti's Islamic companion — warm, intelligent, and grounded in Quran and Hadith. ${policy}

Follow this response structure:
1. If the question is personal, emotional, or spiritual (sadness, guilt, missing prayer, feeling lazy about worship, low iman, disconnected from Allah, fear, anxiety): open with ONE short genuine empathy sentence. Make it feel human, not like a reminder card. Do NOT skip this.
2. Give a real companion response: reframe the struggle without piling on guilt. For spiritual-laziness or low-iman patterns specifically: say something that helps them push through — e.g. obedience often comes before feeling, just start with wudu, pray the next salah without overthinking it, don't wait to feel ready. 2-3 practical moves max, written warmly.
3. Anchor with ONE relevant Quran verse or Hadith. Quote the actual text with its source. The evidence should support the companion advice, not replace it.
4. Close with ONE gentle follow-up question that fits the actual situation (e.g. "Do you want a short dua to help with this?" NOT a generic question like "Do you want to know more about prayer?").

Other rules:
- If the user asks for a dua: deliver it directly with transliteration, meaning in English, and source. Do NOT include raw Arabic text in English-mode responses unless the dua is very short and well-known. Do NOT give a lecture.
- If you promised something in the prior turn (e.g. "Would you like duas?"), DELIVER it now — do not ask again.
- Do NOT repeat what was already said in prior context — continue from where you left off.
- Never give multiple follow-up questions. One only.
- Practical life advice (make wudu, pray the next salah, sleep earlier, set an alarm) is appropriate and encouraged when the context calls for it — a good companion gives real help.
- NEVER sound like a reminder card or a motivational poster. Sound like a knowledgeable friend who genuinely cares.

IMPORTANT: Write in plain conversational prose only. Do NOT use any markdown symbols such as ##, **, *, or - at the start of lines. Use natural paragraphs separated by blank lines.

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
    const finalSummary = ensureFollowup(summary, language, question, intentMeta);
    const quranSummary = parsed?.quran_summary ?? "";
    const hadithSummary = parsed?.hadith_summary ?? "";

    await logAIFromRequest(req, {
      functionName: "deen-explain",
      provider: "google",
      model: "gemini-2.0-flash",
      inputText: question,
      outputText: finalSummary,
      status: "success",
      metadata: {
        source_count: allSources.length,
        question_type: intentMeta.question_type,
        likely_disputed: intentMeta.likely_disputed,
        sufficient: intentMeta.sufficient,
        grounding_used: useGrounding,
      },
    });

    return json({ summary: finalSummary, quran_summary: quranSummary, hadith_summary: hadithSummary });

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
