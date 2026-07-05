import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ─────────────────────────────────────────────────────────────
// ISLAMIC BRAIN — question classification types
// ─────────────────────────────────────────────────────────────
type QuestionType =
  | "reference_lookup"   // user wants a specific verse or hadith
  | "simple_evidence"    // "what does quran/hadith say about X"
  | "fiqh_question"      // ruling / permissibility / obligation
  | "followup"           // continuation of prior conversation
  | "sensitive"          // apostasy, takfir, divorce, punishments etc.
  | "general_islamic";   // general knowledge / explanation

type IntentResult = {
  question_type: QuestionType;
  normalized_topic: string;       // clean Islamic topic, e.g. "zakat on worn gold jewelry"
  likely_disputed: boolean;       // is this a known scholarly debate?
  needs_caution: boolean;         // high-stakes / sensitive ruling
  clarification_needed: boolean;  // too vague to search well
  clarification_prompt?: string;  // what to ask the user
  followup_anchor?: string;       // prior topic to stay anchored on
};

type ConversationTurn = {
  question: string;
  answer: string;
  topic: string;
};

type SearchRow = {
  source_type: "quran" | "hadith";
  reference: string;
  surah_number: number | null;
  ayah_number: number | null;
  collection_id: string | null;
  hadith_number: string | null;
  title_en: string | null;
  title_ar: string | null;
  arabic_text: string | null;
  english_text: string | null;
  grade: string | null;
  score: number | null;
};

type ResponseSource = {
  source_type: "quran" | "hadith";
  reference: string;
  title: string;
  surah_number: number | null;
  ayah_number: number | null;
  collection_id: string | null;
  hadith_number: string | null;
  text: string;
  translation: string;
  arabic_text: string;
  english_text: string;
  grade: string;
};

type WebResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchOption = "quran" | "hadith" | "islamweb";
type ForcedSearch = SearchOption | "both" | "none";

type ChatModeResult = {
  mode: "chat" | "offer_search";
  message: string;
  search_options: SearchOption[];
};

type EvidenceAnswerResult = {
  summary: string;
  web_results: WebResult[];
};

type ClarificationOption = {
  id: string;
  label: string;
  topic: string;
};

type SelectedOption = {
  id: string;
  label: string;
  topic: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s:.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTerms(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function isIslamwebUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "islamweb.net" || host.endsWith(".islamweb.net");
  } catch {
    return url.toLowerCase().includes("islamweb.net");
  }
}

function extractWebResults(groundingMetadata: unknown): WebResult[] {
  if (!groundingMetadata || typeof groundingMetadata !== "object") return [];

  const metadata = groundingMetadata as {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    groundingSupports?: Array<{ groundingChunkIndices?: number[]; segment?: { text?: string } }>;
  };

  const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
  const supports = Array.isArray(metadata.groundingSupports) ? metadata.groundingSupports : [];
  const supportTextByChunk = new Map<number, string>();

  supports.forEach((support) => {
    const indices = Array.isArray(support.groundingChunkIndices) ? support.groundingChunkIndices : [];
    const segmentText = typeof support.segment?.text === "string" ? support.segment.text.trim() : "";
    if (!segmentText) return;
    indices.forEach((index) => {
      if (!supportTextByChunk.has(index)) supportTextByChunk.set(index, segmentText);
    });
  });

  return chunks
    .map((chunk, index) => {
      const uri = chunk.web?.uri;
      if (typeof uri !== "string" || uri.length === 0) return null;
      if (!isIslamwebUrl(uri)) return null;
      const title = typeof chunk.web?.title === "string" && chunk.web.title.trim().length > 0
        ? chunk.web.title.trim()
        : uri;
      return {
        title,
        url: uri,
        snippet: supportTextByChunk.get(index) ?? "",
      } satisfies WebResult;
    })
    .filter((item): item is WebResult => Boolean(item))
    .slice(0, 6);
}

function detectQuestionType(query: string, priorTopic: string | null): QuestionType {
  const normalized = normalizeText(query);
  if (parseQuranReference(query) || parseHadithReference(query)) return "reference_lookup";
  if (/\b(halal|haram|allowed|forbidden|permissible|rule|ruling|obligatory|obligation|sin|invalid|valid|fatwa)\b|حلال|حرام|يجوز|لا يجوز|حكم|واجب|فرض|سنة|بدعة|ذنب/.test(normalized)) return "fiqh_question";
  if (/\b(divorce|talaq|apostasy|takfir|inheritance|custody|punishment)\b|طلاق|ردة|تكفير|ميراث|حضانة|حد/.test(normalized)) return "sensitive";
  if (priorTopic && /^(what about|and if|and what if|what if|can i|is it|does that|this|that|it|them|these|those|وماذا|طيب|واذا|وإذا|هل هذا|هل ذلك|هذا|ذلك|هي|هو)\b/.test(normalized)) return "followup";
  return "general_islamic";
}

function sanitizeSearchOptions(value: unknown): SearchOption[] {
  if (!Array.isArray(value)) return [];
  const valid: SearchOption[] = ["quran", "hadith", "islamweb"];
  const out: SearchOption[] = [];
  for (const v of value) {
    if (typeof v === "string" && (valid as string[]).includes(v) && !out.includes(v as SearchOption)) {
      out.push(v as SearchOption);
    }
  }
  return out;
}

function fallbackOfferMessage(language: "ar" | "en"): string {
  return language === "ar"
    ? "أريد أن أعطيك إجابة دقيقة. هل تريد أن أبحث لك عن حديث، آية من القرآن، أو في موقع إسلام ويب؟"
    : "I want to give you an accurate answer. Would you like me to check a Hadith, a Quran verse, or islamweb.net for this?";
}

function fallbackChatMessage(language: "ar" | "en"): string {
  return language === "ar"
    ? "عذراً، لم أستطع معالجة ذلك الآن. حاول مرة أخرى بصياغة مختلفة."
    : "Sorry, I could not process that right now. Please try rephrasing your question.";
}

function simplifyQuery(query: string) {
  const normalized = normalizeText(query);
  const englishStopwords = new Set(["what", "does", "do", "is", "are", "the", "a", "an", "about", "in", "on", "for", "to", "of", "and", "or", "please", "tell", "me", "give", "show", "with", "from", "according", "say", "says", "said", "can", "could", "would", "should", "how", "when", "where", "why", "if", "i", "my", "we", "our", "you", "your", "islam", "muslim", "quran", "hadith", "sunnah", "verse", "verses", "ayah", "ayat", "surah"]);
  const arabicStopwords = new Set(["ما", "ماذا", "عن", "في", "من", "الى", "إلى", "على", "هل", "كيف", "متى", "اين", "أين", "لماذا", "لو", "اذا", "إذا", "أنا", "انا", "نحن", "هو", "هي", "هذا", "هذه", "ذلك", "تلك", "الاسلام", "الإسلام", "مسلم", "قرآن", "القرآن", "القران", "حديث", "الحديث", "السنة", "سنة", "آية", "اية", "آيات", "ايات", "سورة"]);
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 1 && !englishStopwords.has(token) && !arabicStopwords.has(token));
  return tokens.slice(0, 8).join(" ");
}

function buildHeuristicIntent(query: string, priorTopic: string | null): IntentResult {
  const simplified = simplifyQuery(query);
  const normalizedTopic = simplified || normalizeText(query) || query.trim();
  const questionType = detectQuestionType(query, priorTopic);
  const likelyDisputed = /\b(music|niqab|gold|drawing|images|celebrating|mawlid|voting|bank interest|insurance)\b|موسيقى|نقاب|ذهب|رسم|صور|احتفال|مولد|انتخابات|ربا|تأمين/.test(normalizeText(query));
  const needsCaution = questionType === "fiqh_question" || questionType === "sensitive";
  return {
    question_type: questionType,
    normalized_topic: normalizedTopic,
    likely_disputed: likelyDisputed,
    needs_caution: needsCaution,
    clarification_needed: false,
    followup_anchor: priorTopic || undefined,
  };
}

function buildNoResultsSummary(language: "ar" | "en") {
  return language === "ar"
    ? "لم أجد دليلاً واضحاً من القرآن أو الحديث لهذا السؤال بهذه الصياغة. جرّب كلمات أبسط أو مرجعاً مباشراً مثل 2:255 أو Bukhari 1."
    : "I could not find a clear Quran or Hadith match for that wording yet. Try simpler keywords or a direct reference like 2:255 or Bukhari 1.";
}

function buildFallbackSummary(language: "ar" | "en", quranResults: ResponseSource[], hadithResults: ResponseSource[]) {
  const firstQuran = quranResults[0];
  const firstHadith = hadithResults[0];
  if (language === "ar") {
    if (firstQuran && firstHadith) {
      return `وجدت لك دليلاً من القرآن ودليلاً من الحديث في هذا المعنى. اقرأ النصوص أولاً، ثم خذ الخلاصة من هذه الأدلة دون توسع خارجها.`;
    }
    if (firstQuran) {
      return `وجدت لك آية مرتبطة بسؤالك. المعنى الأقرب من النص هو ما يظهر في الآية المعروضة دون زيادة من خارجها.`;
    }
    if (firstHadith) {
      return `وجدت لك حديثاً مرتبطاً بسؤالك. المعنى الأقرب من النص هو ما يظهر في الحديث المعروض دون زيادة من خارجه.`;
    }
    return buildNoResultsSummary(language);
  }

  if (firstQuran && firstHadith) {
    return "I found both a Quran source and a Hadith source related to your question. Read the texts first, then take the meaning from those sources only.";
  }
  if (firstQuran) {
    return "I found a Quran verse related to your question. The clearest meaning should be taken from the verse shown here without adding outside claims.";
  }
  if (firstHadith) {
    return "I found a Hadith related to your question. The clearest meaning should be taken from the Hadith shown here without adding outside claims.";
  }
  return buildNoResultsSummary(language);
}

function buildChatSystemPrompt(language: "ar" | "en"): string {
  return language === "ar"
    ? `أنت "رفيق الدين" في تطبيق Wakti — صديق مسلم واعٍ يتحدث مع المستخدم بشكل طبيعي وودود. تتحدث فقط عن الإسلام: القرآن، الحديث، الفقه، التاريخ الإسلامي، العبادات، وحياة المسلم اليومية. إذا سأل المستخدم عن أي شيء خارج الإسلام، اعتذر بلطف ووجّه الحديث نحو موضوع إسلامي — لا تُجب أبداً عن أسئلة غير متعلقة بالدين.

تحدث بأسلوب طبيعي ومشجع، كصديق مهتم، وليس كمحرك بحث أو عالم رسمي. يمكنك تقديم نصائح عملية للحياة اليومية طالما أنها مبنية على قيم إسلامية.

أجب دائماً مباشرة من معرفتك الإسلامية أولاً. حتى لو ورد في السؤال كلمات مثل "قرآن"، "حديث"، "سنة" أو "دعاء"، لا تزال تجيب من معرفتك أولاً. لا تختلق أو تخمّن نص آية أو حديث، ولا رقم مرجع إن لم تكن متأكداً تماماً.

إذا لم تكن واثقاً تماماً، أو كان السؤال حكماً فقهياً أو أمراً حساساً يستحق دليلاً حقيقياً، لا تخمّن ولا تختلق مصدراً. بدلاً من ذلك، توقف واطلب إذن المستخدم للبحث، وأخبره بالضبط بما يمكنك التحقق منه: حديث، آية من القرآن، أو بحث في islamweb.net فقط (الموقع الوحيد المسموح لك بذكره أو استخدامه).

لا تذكر أبداً Google أو أي محرك بحث أو أي موقع آخر غير islamweb.net.

أجب دائماً بلغة المستخدم ولا تستخدم رموز Markdown.

أخرج الرد فقط بهذا الشكل:
{"mode":"chat" أو "offer_search","message":"نص ردك، أو سؤال طلب الإذن إذا كان mode هو offer_search","search_options":["quran","hadith","islamweb"]}
اترك search_options فارغة [] إذا كان mode هو chat، وإلا املأها دائماً بكل الخيارات: quran، hadith، islamweb.`
    : `You are Wakti's Deen Buddy — a warm, knowledgeable Muslim friend having a real conversation with the user. You only talk about Islam: the Quran, Hadith, fiqh, Islamic history, worship, and daily Muslim life. If the user asks about anything outside Islam, gently decline and steer the conversation back to Islamic topics — never answer unrelated questions.

Speak naturally and encouragingly, like a caring friend, not like a search engine or a formal scholar. You can share practical, day-to-day advice too, as long as it stays rooted in Islamic values.

Always answer first from your own Islamic knowledge. Even if the user mentions the words "quran", "hadith", "sunnah", or "dua", you still answer from your knowledge first. Do not invent or guess the exact wording of a Quran ayah or a Hadith, and do not invent a reference number if you are not fully sure it is correct.

If you are not fully confident in your answer, or the topic is a fiqh ruling, a sensitive matter, or anything that really should be backed by a real citation, do NOT guess or fabricate a source. Instead, pause and ask the user for permission to look it up, and tell them exactly what you could check: a relevant Hadith, a Quran verse, or a search on islamweb.net (the only outside website you are ever allowed to use or mention).

Never mention Google, search engines, or any website other than islamweb.net.

Always reply in the user's language and never use markdown formatting.

Respond only in this JSON shape:
{"mode":"chat" or "offer_search","message":"your reply text, or your permission-asking question if mode is offer_search","search_options":["quran","hadith","islamweb"]}
Leave search_options empty [] when mode is chat, otherwise always include all options: quran, hadith, islamweb.`;
}

async function generateChatResponse(
  req: Request,
  question: string,
  language: "ar" | "en",
  conversationHistory: ConversationTurn[],
  opts: { forceOffer: boolean; blockOffer: boolean },
): Promise<ChatModeResult> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const fallbackOptions: SearchOption[] = ["quran", "hadith", "islamweb"];

  if (!GEMINI_API_KEY) {
    if (opts.forceOffer && !opts.blockOffer) return { mode: "offer_search", message: fallbackOfferMessage(language), search_options: fallbackOptions };
    return { mode: "chat", message: fallbackChatMessage(language), search_options: [] };
  }

  const system = buildChatSystemPrompt(language);

  let contextBlock = "";
  if (conversationHistory.length > 0) {
    const formattedHistory = conversationHistory.map((turn, i) => {
      const q = turn.question?.trim() ?? "";
      const a = turn.answer?.trim() ?? "";
      return language === "ar"
        ? `${i + 1}. المستخدم: ${q}\n   الجواب السابق: ${a}`
        : `${i + 1}. User: ${q}\n   Previous answer: ${a}`;
    }).join("\n\n");
    contextBlock = language === "ar"
      ? `سياق المحادثة السابق (للرجوع فقط):\n${formattedHistory}\n\n`
      : `Previous conversation context (for reference only):\n${formattedHistory}\n\n`;
  }

  let instruction = "";
  if (opts.blockOffer) {
    instruction = language === "ar"
      ? "أعطِ أفضل إجابة لديك الآن من معرفتك الإسلامية الخاصة. لا تطلب البحث مرة أخرى، ويجب أن يكون mode هو chat."
      : "Give your best answer now using your own Islamic knowledge. Do not ask to search again — mode must be chat.";
  } else if (opts.forceOffer) {
    instruction = language === "ar"
      ? "هذا السؤال يتعلق بحكم فقهي أو أمر حساس ويحتاج دليلاً حقيقياً. أجب من معرفتك أولاً باختصار، ثم اعرض خيارات البحث للمستخدم."
      : "This question is a fiqh ruling or a sensitive matter and needs real evidence. Answer briefly from your knowledge first, then offer the search options to the user.";
  }

  const userPrompt = language === "ar"
    ? `${contextBlock}السؤال الحالي: ${question}\n\n${instruction}`
    : `${contextBlock}Current question: ${question}\n\n${instruction}`;

  const startedAt = Date.now();
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`chat_failed:${resp.status}:${errorText.slice(0, 200)}`);
    }

    const payload = await resp.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(rawText);

    let mode: "chat" | "offer_search" = parsed?.mode === "offer_search" ? "offer_search" : "chat";
    let message = typeof parsed?.message === "string" && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : (mode === "offer_search" ? fallbackOfferMessage(language) : fallbackChatMessage(language));
    let searchOptions = sanitizeSearchOptions(parsed?.search_options);

    if (opts.blockOffer) {
      mode = "chat";
      searchOptions = [];
    } else if (mode === "offer_search") {
      // Always show all three chips; the AI does not pick which options appear.
      searchOptions = fallbackOptions;
    }

    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: message,
      durationMs: Date.now() - startedAt,
      status: "success",
      metadata: { mode: "chat_mode", result_mode: mode },
    });

    return { mode, message, search_options: mode === "offer_search" ? searchOptions : [] };
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: "",
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { mode: "chat_mode" },
    });

    if (opts.forceOffer && !opts.blockOffer) return { mode: "offer_search", message: fallbackOfferMessage(language), search_options: fallbackOptions };
    return { mode: "chat", message: fallbackChatMessage(language), search_options: [] };
  }
}

function buildEvidenceSystemPrompt(language: "ar" | "en", useWebSearch: boolean): string {
  return language === "ar"
    ? `أنت "رفيق الدين" في تطبيق Wakti. طلب المستخدم منك التحقق من دليل حقيقي لسؤاله. أجب بأسلوب دافئ ومشجع كصديق مطّلع، معتمداً فقط على ${useWebSearch ? "نتائج البحث من islamweb.net" : "المصادر المعروضة أدناه من القرآن والحديث"}. لا تستخدم أي مصدر خارجي آخر، ولا تذكر Google أو أي موقع غير islamweb.net. إذا كانت الأدلة قليلة أو غير كافية فقل ذلك بوضوح ولطف. أضف نصيحة عملية مشجعة عند المناسبة دون مخالفة الأدلة. لا تضف سؤال متابعة. لا تستخدم markdown. سياق المحادثة السابقة للرجوع فقط. أخرج JSON فقط بهذا الشكل: {"summary":"..."}`
    : `You are Wakti's Deen Buddy. The user asked you to check for real evidence for their question. Answer warmly and encouragingly, like a knowledgeable friend, relying only on ${useWebSearch ? "islamweb.net search results" : "the Quran and Hadith sources shown below"}. Do not use any other outside source, and do not mention Google or any website other than islamweb.net. If the evidence is limited or insufficient, say so clearly and kindly. Add practical, encouraging advice when relevant, without contradicting the evidence. Do not add a follow-up question. Do not use markdown. Previous conversation context is for reference only. Output JSON only in this shape: {"summary":"..."}`;
}

async function generateEvidenceAnswer(
  req: Request,
  question: string,
  language: "ar" | "en",
  conversationHistory: ConversationTurn[],
  options: {
    quranResults?: ResponseSource[];
    hadithResults?: ResponseSource[];
    useWebSearch?: boolean;
    topic?: string;
  },
): Promise<EvidenceAnswerResult> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const quranResults = options.quranResults ?? [];
  const hadithResults = options.hadithResults ?? [];
  const useWebSearch = options.useWebSearch ?? false;
  const topic = options.topic?.trim() || question;
  const allSources = [...quranResults, ...hadithResults].slice(0, 6);

  if (!GEMINI_API_KEY) {
    return { summary: buildFallbackSummary(language, quranResults, hadithResults), web_results: [] };
  }
  if (allSources.length === 0 && !useWebSearch) {
    return { summary: buildNoResultsSummary(language), web_results: [] };
  }

  const evidenceBlock = allSources.length > 0
    ? allSources.map((item, index) => {
      const visibleText = item.english_text || item.text || item.arabic_text || "";
      const trimmedText = visibleText.length > 380 ? `${visibleText.slice(0, 380).trimEnd()}…` : visibleText;
      return `[${index + 1}] ${item.source_type.toUpperCase()} — ${item.reference}${item.grade ? ` (${item.grade})` : ""}\n${trimmedText}`;
    }).join("\n\n")
    : "";

  const system = buildEvidenceSystemPrompt(language, useWebSearch);

  let contextBlock = "";
  if (conversationHistory.length > 0) {
    const formattedHistory = conversationHistory.map((turn, i) => {
      const q = turn.question?.trim() ?? "";
      const a = turn.answer?.trim() ?? "";
      return language === "ar"
        ? `${i + 1}. المستخدم: ${q}\n   الجواب السابق: ${a}`
        : `${i + 1}. User: ${q}\n   Previous answer: ${a}`;
    }).join("\n\n");
    contextBlock = language === "ar"
      ? `سياق المحادثة السابق (للرجوع فقط):\n${formattedHistory}\n\n`
      : `Previous conversation context (for reference only):\n${formattedHistory}\n\n`;
  }

  const userPrompt = language === "ar"
    ? `${contextBlock}السؤال الحالي: ${question}\nالموضوع المحدد: ${topic}\n\n${evidenceBlock ? `المصادر:\n${evidenceBlock}\n\n` : ""}اكتب جواباً مباشراً وقصيراً ومفيداً.`
    : `${contextBlock}Current question: ${question}\nFocused topic: ${topic}\n\n${evidenceBlock ? `Sources:\n${evidenceBlock}\n\n` : ""}Write a direct, helpful answer.`;

  const startedAt = Date.now();
  try {
    const requestBody: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${userPrompt}` }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    };
    if (useWebSearch) {
      requestBody.tools = [{ google_search: {} }];
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`evidence_failed:${resp.status}:${errorText.slice(0, 200)}`);
    }

    const payload = await resp.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(rawText);
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : (useWebSearch ? buildNoResultsSummary(language) : buildFallbackSummary(language, quranResults, hadithResults));
    const webResults = useWebSearch ? extractWebResults(payload?.candidates?.[0]?.groundingMetadata) : [];

    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: summary,
      durationMs: Date.now() - startedAt,
      status: "success",
      metadata: { mode: "evidence_mode", source_count: allSources.length, used_web_search: useWebSearch },
    });

    return { summary, web_results: webResults };
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: buildFallbackSummary(language, quranResults, hadithResults),
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { mode: "evidence_mode", source_count: allSources.length, used_web_search: useWebSearch },
    });
    return { summary: buildFallbackSummary(language, quranResults, hadithResults), web_results: [] };
  }
}

// Well-known Quran verse aliases
const QURAN_ALIASES: { patterns: RegExp[]; surah: number; ayah: number }[] = [
  { patterns: [/ayat\s*ul\s*kursi/i, /ayatul\s*kursi/i, /آية\s*الكرسي/i, /اية\s*الكرسي/i, /kursi/i], surah: 2, ayah: 255 },
  { patterns: [/al\s*fatiha/i, /fatiha/i, /surah\s*1\b/i, /opening/i, /الفاتحة/i], surah: 1, ayah: 1 },
  { patterns: [/surah\s*al\s*ikhlas/i, /al\s*ikhlas/i, /ikhlas/i, /الإخلاص/i, /الاخلاص/i], surah: 112, ayah: 1 },
  { patterns: [/al\s*falaq/i, /الفلق/i], surah: 113, ayah: 1 },
  { patterns: [/al\s*nas\b/i, /surah\s*nas/i, /الناس/i], surah: 114, ayah: 1 },
  { patterns: [/throne\s*verse/i], surah: 2, ayah: 255 },
];

// Surah name → number map for queries like "1st verse of al baqara"
const SURAH_NAME_MAP: { patterns: RegExp[]; number: number }[] = [
  { patterns: [/al\s*baqara/i, /baqarah/i, /البقرة/i], number: 2 },
  { patterns: [/al\s*imran/i, /آل\s*عمران/i], number: 3 },
  { patterns: [/al\s*nisa/i, /النساء/i], number: 4 },
  { patterns: [/al\s*maidah/i, /المائدة/i], number: 5 },
  { patterns: [/al\s*anam/i, /الأنعام/i], number: 6 },
  { patterns: [/al\s*araf/i, /الأعراف/i], number: 7 },
  { patterns: [/al\s*anfal/i, /الأنفال/i], number: 8 },
  { patterns: [/al\s*tawba/i, /التوبة/i], number: 9 },
  { patterns: [/yunus/i, /يونس/i], number: 10 },
  { patterns: [/al\s*kahf/i, /الكهف/i], number: 18 },
  { patterns: [/maryam/i, /مريم/i], number: 19 },
  { patterns: [/ya\s*sin/i, /يس/i], number: 36 },
  { patterns: [/al\s*rahman/i, /الرحمن/i], number: 55 },
  { patterns: [/al\s*waqiah/i, /الواقعة/i], number: 56 },
  { patterns: [/al\s*mulk/i, /الملك/i], number: 67 },
  { patterns: [/al\s*insan/i, /الإنسان/i], number: 76 },
];

const VERSE_ORDINALS: { pattern: RegExp; ayah: number }[] = [
  { pattern: /\b(first|1st|one|الأول|الاول|الأولى)\b/i, ayah: 1 },
  { pattern: /\b(second|2nd|الثاني|الثانية)\b/i, ayah: 2 },
  { pattern: /\b(third|3rd|الثالث)\b/i, ayah: 3 },
  { pattern: /\b(last|الأخير|الأخيرة)\b/i, ayah: -1 }, // -1 means last
];

function parseQuranReference(query: string): { surah: number; ayah: number } | null {
  // 1. Direct numeric reference: 2:255 or 2/255
  const numMatch = query.match(/(?:^|\s)(\d{1,3})\s*[:/]\s*(\d{1,3})(?:\s|$)/);
  if (numMatch) {
    const surah = Number(numMatch[1]);
    const ayah = Number(numMatch[2]);
    if (surah >= 1 && surah <= 114 && ayah >= 1 && ayah <= 286) return { surah, ayah };
  }

  // 2. Well-known verse aliases
  for (const alias of QURAN_ALIASES) {
    if (alias.patterns.some((p) => p.test(query))) {
      return { surah: alias.surah, ayah: alias.ayah };
    }
  }

  // 3. Surah name + optional verse ordinal ("1st verse of al baqara", "al kahf verse 1")
  for (const surahEntry of SURAH_NAME_MAP) {
    if (surahEntry.patterns.some((p) => p.test(query))) {
      // Look for an explicit verse number: "verse 5", "ayah 5", "ayat 5"
      const verseNumMatch = query.match(/(?:verse|ayah|ayat|آية|اية)\s*(\d+)/i);
      if (verseNumMatch) {
        return { surah: surahEntry.number, ayah: Number(verseNumMatch[1]) };
      }
      // Look for ordinals
      for (const ordinal of VERSE_ORDINALS) {
        if (ordinal.pattern.test(query) && ordinal.ayah !== -1) {
          return { surah: surahEntry.number, ayah: ordinal.ayah };
        }
      }
      // Default to ayah 1
      return { surah: surahEntry.number, ayah: 1 };
    }
  }

  return null;
}

const COLLECTION_ALIASES = [
  { id: "bukhari", aliases: ["bukhari", "al-bukhari", "albukhari", "بخاري", "البخاري"] },
  { id: "muslim", aliases: ["muslim", "مسلم", "صحيح مسلم"] },
  { id: "abudawud", aliases: ["abudawud", "abu dawud", "ابو داود", "أبو داود"] },
  { id: "tirmidhi", aliases: ["tirmidhi", "termedhi", "ترمذي", "الترمذي"] },
  { id: "ibnmajah", aliases: ["ibnmajah", "ibn majah", "ابن ماجه"] },
  { id: "nasai", aliases: ["nasai", "nasa'i", "نسائي", "النسائي"] },
] as const;

function parseHadithReference(query: string) {
  const normalized = normalizeText(query);
  for (const collection of COLLECTION_ALIASES) {
    if (!collection.aliases.some((alias) => normalized.includes(normalizeText(alias)))) continue;
    const refMatch = query.match(/(\d+(?:\.\d+)?)/);
    const hadithNumber = refMatch?.[1]?.trim();
    if (hadithNumber) {
      return { collectionId: collection.id, hadithNumber };
    }
  }
  return null;
}

function mapSearchRow(row: SearchRow, language: "ar" | "en"): ResponseSource {
  const isArabic = language === "ar";
  return {
    source_type: row.source_type,
    reference: row.reference,
    title: isArabic ? row.title_ar || row.title_en || row.reference : row.title_en || row.reference,
    surah_number: row.surah_number,
    ayah_number: row.ayah_number,
    collection_id: row.collection_id,
    hadith_number: row.hadith_number,
    text: isArabic && row.arabic_text ? row.arabic_text : row.english_text || row.arabic_text || "",
    translation: isArabic ? row.english_text || "" : row.arabic_text || "",
    arabic_text: row.arabic_text || "",
    english_text: row.english_text || "",
    grade: row.grade || "",
  };
}

async function callGeminiJson<T>(req: Request, prompt: string, temperature = 0.3): Promise<T | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!GEMINI_API_KEY) return null;

  const startedAt = Date.now();
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`gemini_json_failed:${resp.status}:${errorText.slice(0, 200)}`);
    }

    const payload = await resp.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(rawText);

    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: prompt,
      outputText: rawText,
      durationMs: Date.now() - startedAt,
      status: "success",
      metadata: { mode: "json_mode" },
    });

    return parsed as T;
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: prompt,
      outputText: "",
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { mode: "json_mode" },
    });
    console.error("[deen-search] Gemini JSON call failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function generateClarificationOptions(
  req: Request,
  question: string,
  language: "ar" | "en",
  conversationHistory: ConversationTurn[],
  sourceType: "quran" | "hadith" | "islamweb" | "both",
): Promise<ClarificationOption[]> {
  const contextBlock = conversationHistory.length > 0
    ? language === "ar"
      ? `سياق المحادثة السابق:\n${conversationHistory.map((t, i) => `${i + 1}. ${t.question}`).join("\n")}\n\n`
      : `Previous conversation context:\n${conversationHistory.map((t, i) => `${i + 1}. ${t.question}`).join("\n")}\n\n`
    : "";

  const sourceLabel = sourceType === "quran" ? (language === "ar" ? "القرآن" : "Quran")
    : sourceType === "hadith" ? (language === "ar" ? "الحديث" : "Hadith")
    : (language === "ar" ? "إسلام ويب" : "IslamWeb");

  const prompt = language === "ar"
    ? `${contextBlock}المستخدم سأل: "${question}"\nثم اختار البحث في: "${sourceLabel}".\n\nأنشئ 2-3 خيارات لتركيز البحث. كل خيار يمثل موضوعاً إسلامياً محدداً. إذا كان السؤال واضحاً، أرجع خياراً واحداً فقط.\n\nأرجع JSON فقط بهذا الشكل:\n[\n  {"id": "A", "label": "...", "topic": "..."},\n  {"id": "B", "label": "...", "topic": "..."}\n]`
    : `${contextBlock}The user asked: "${question}"\nThen chose to search: "${sourceLabel}".\n\nGenerate 2-3 clarification options to focus the search. Each option should be a specific Islamic topic. If the question is already clear, return only one option.\n\nReturn ONLY JSON in this format:\n[\n  {"id": "A", "label": "...", "topic": "..."},\n  {"id": "B", "label": "...", "topic": "..."}\n]`;

  const result = await callGeminiJson<ClarificationOption[]>(req, prompt, 0.4);
  if (!Array.isArray(result) || result.length === 0) return [];

  return result
    .filter((o) => typeof o.id === "string" && typeof o.label === "string" && typeof o.topic === "string")
    .slice(0, 3);
}

async function findQuranReferences(
  req: Request,
  topic: string,
  language: "ar" | "en",
): Promise<Array<{ surah: number; ayah: number }>> {
  const prompt = language === "ar"
    ? `للموضوع الإسلامي: "${topic}"، اكتب المراجع الدقيقة للقرآن الكريم بصيغة (رقم السورة:رقم الآية).\n\nأرجع JSON فقط بهذا الشكل:\n["2:255", "17:23"]\n\nإذا لم تكن متأكداً، أرجع مصفوفة فارغة [].`
    : `For the Islamic topic: "${topic}", list the exact Quran references (surah:ayah) that are most relevant.\n\nReturn ONLY JSON in this format:\n["2:255", "17:23"]\n\nIf unsure, return an empty array [].`;

  const refs = await callGeminiJson<string[]>(req, prompt, 0.2);
  if (!Array.isArray(refs)) return [];

  const parsed: Array<{ surah: number; ayah: number }> = [];
  for (const ref of refs) {
    const m = String(ref).match(/^(\d{1,3})\s*[:/]\s*(\d{1,3})$/);
    if (!m) continue;
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    if (surah >= 1 && surah <= 114 && ayah >= 1 && ayah <= 286) parsed.push({ surah, ayah });
  }
  return parsed.slice(0, 5);
}

async function findHadithReferences(
  req: Request,
  topic: string,
  language: "ar" | "en",
): Promise<Array<{ collectionId: string; hadithNumber: string }>> {
  const prompt = language === "ar"
    ? `للموضوع الإسلامي: "${topic}"، اكتب أرقام الأحاديث الأكثر صلة من الصحيح الستة.\n\nأرجع JSON فقط بهذا الشكل:\n["Bukhari 1", "Muslim 202", "Tirmidhi 1169", "Abu Dawud 1", "Nasai 1", "Ibn Majah 1"]\n\nإذا لم تكن متأكداً، أرجع مصفوفة فارغة [].`
    : `For the Islamic topic: "${topic}", list the most relevant Sahih Sitta hadith references.\n\nReturn ONLY JSON in this format:\n["Bukhari 1", "Muslim 202", "Tirmidhi 1169", "Abu Dawud 1", "Nasai 1", "Ibn Majah 1"]\n\nIf unsure, return an empty array [].`;

  const refs = await callGeminiJson<string[]>(req, prompt, 0.2);
  if (!Array.isArray(refs)) return [];

  const parsed: Array<{ collectionId: string; hadithNumber: string }> = [];
  for (const ref of refs) {
    const parsedRef = parseHadithReference(ref);
    if (parsedRef) parsed.push(parsedRef);
  }
  return parsed.slice(0, 5);
}

async function fetchQuranVerses(
  supabase: ReturnType<typeof createClient>,
  refs: Array<{ surah: number; ayah: number }>,
  language: "ar" | "en",
): Promise<ResponseSource[]> {
  const results: ResponseSource[] = [];
  for (const ref of refs) {
    const { data, error } = await supabase
      .from("deen_quran_verses")
      .select("surah_number, ayah_number, surah_name_ar, surah_name_en, arabic_text, english_text")
      .eq("surah_number", ref.surah)
      .eq("ayah_number", ref.ayah)
      .maybeSingle();
    if (error || !data) continue;
    results.push({
      source_type: "quran",
      reference: `${data.surah_name_en} ${data.surah_number}:${data.ayah_number}`,
      title: language === "ar" ? data.surah_name_ar : data.surah_name_en,
      surah_number: data.surah_number,
      ayah_number: data.ayah_number,
      collection_id: null,
      hadith_number: null,
      text: language === "ar" ? data.arabic_text : data.english_text,
      translation: language === "ar" ? data.english_text : data.arabic_text,
      arabic_text: data.arabic_text,
      english_text: data.english_text,
      grade: "",
    });
  }
  return results;
}

async function fetchHadithEntries(
  supabase: ReturnType<typeof createClient>,
  refs: Array<{ collectionId: string; hadithNumber: string }>,
  language: "ar" | "en",
): Promise<ResponseSource[]> {
  const results: ResponseSource[] = [];
  for (const ref of refs) {
    const { data, error } = await supabase
      .from("deen_hadith_entries")
      .select("collection_id, hadith_number, english_text, arabic_text, grade")
      .eq("collection_id", ref.collectionId)
      .eq("hadith_number", ref.hadithNumber)
      .maybeSingle();
    if (error || !data) continue;

    const { data: collection } = await supabase
      .from("deen_hadith_collections")
      .select("name_en, name_ar")
      .eq("collection_id", ref.collectionId)
      .maybeSingle();

    results.push({
      source_type: "hadith",
      reference: `${collection?.name_en ?? ref.collectionId} #${data.hadith_number}`,
      title: language === "ar" ? collection?.name_ar || collection?.name_en || ref.collectionId : collection?.name_en || ref.collectionId,
      surah_number: null,
      ayah_number: null,
      collection_id: data.collection_id,
      hadith_number: data.hadith_number,
      text: language === "ar" && data.arabic_text ? data.arabic_text : data.english_text,
      translation: language === "ar" ? data.english_text || "" : data.arabic_text || "",
      arabic_text: data.arabic_text || "",
      english_text: data.english_text || "",
      grade: data.grade || "",
    });
  }
  return results;
}

async function handleSourceSearch(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  query: string,
  language: "ar" | "en",
  intent: IntentResult,
  conversationHistory: ConversationTurn[],
  searchType: "quran" | "hadith" | "both" | "islamweb",
  phase: "clarify" | "search",
  selectedOption: SelectedOption | null,
) {
  if (phase === "clarify") {
    const options = await generateClarificationOptions(req, query, language, conversationHistory, searchType);
    return {
      query,
      mode: "clarify",
      options,
      search_type: searchType,
      quran_results: [],
      hadith_results: [],
      web_results: [],
      summary: "",
      intent,
      meta: { found: false, quran_count: 0, hadith_count: 0 },
    };
  }

  const topic = selectedOption?.topic?.trim() || query;

  if (searchType === "islamweb") {
    const evidence = await generateEvidenceAnswer(req, query, language, conversationHistory, { useWebSearch: true, topic });
    return {
      query,
      mode: "evidence",
      quran_results: [],
      hadith_results: [],
      web_results: evidence.web_results,
      summary: evidence.summary,
      intent,
      meta: { found: evidence.web_results.length > 0, quran_count: 0, hadith_count: 0, sufficient: evidence.web_results.length > 0 },
    };
  }

  let quranResults: ResponseSource[] = [];
  let hadithResults: ResponseSource[] = [];

  if (searchType === "quran" || searchType === "both") {
    const quranRefs = await findQuranReferences(req, topic, language);
    quranResults = await fetchQuranVerses(supabase, quranRefs, language);
  }

  if (searchType === "hadith" || searchType === "both") {
    const hadithRefs = await findHadithReferences(req, topic, language);
    hadithResults = await fetchHadithEntries(supabase, hadithRefs, language);
  }

  if (quranResults.length === 0 && hadithResults.length === 0) {
    // Smart fallback: try IslamWeb first, then answer from knowledge.
    const webEvidence = await generateEvidenceAnswer(req, query, language, conversationHistory, { useWebSearch: true, topic });
    if (webEvidence.web_results.length > 0) {
      return {
        query,
        mode: "evidence",
        quran_results: [],
        hadith_results: [],
        web_results: webEvidence.web_results,
        summary: webEvidence.summary,
        intent,
        meta: { found: true, quran_count: 0, hadith_count: 0, sufficient: true },
      };
    }

    const chatResult = await generateChatResponse(req, query, language, conversationHistory, { forceOffer: false, blockOffer: true });
    return {
      query,
      mode: "chat",
      quran_results: [],
      hadith_results: [],
      web_results: [],
      summary: chatResult.message,
      intent,
      meta: { found: false, quran_count: 0, hadith_count: 0, sufficient: false },
    };
  }

  const evidence = await generateEvidenceAnswer(req, query, language, conversationHistory, { quranResults, hadithResults, useWebSearch: false });
  return {
    query,
    mode: "evidence",
    quran_results: quranResults,
    hadith_results: hadithResults,
    web_results: [],
    summary: evidence.summary,
    intent,
    meta: { found: true, quran_count: quranResults.length, hadith_count: hadithResults.length, sufficient: true },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? body?.question ?? "").trim();
    const language: "ar" | "en" = body?.language === "ar" ? "ar" : "en";
    const limit = Math.max(1, Math.min(Number(body?.limit ?? 5), 8));
    const priorTopic: string | null = typeof body?.prior_topic === "string" ? body.prior_topic.trim() || null : null;
    const conversationHistory: ConversationTurn[] = Array.isArray(body?.conversation_history) ? body.conversation_history : [];
    const rawForcedSearch = typeof body?.forced_search === "string" ? body.forced_search : null;
    const forcedSearch: ForcedSearch | null = rawForcedSearch && ["quran", "hadith", "islamweb", "both", "none"].includes(rawForcedSearch)
      ? rawForcedSearch as ForcedSearch
      : null;
    const phase = body?.phase === "clarify" || body?.phase === "search" ? body.phase as "clarify" | "search" : "search";
    const selectedOption = body?.selected_option && typeof body.selected_option === "object"
      ? {
          id: String(body.selected_option.id ?? ""),
          label: String(body.selected_option.label ?? ""),
          topic: String(body.selected_option.topic ?? ""),
        }
      : null;

    if (!query) return json({ error: "missing_query" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ── Step 1: Classify question with the Islamic brain ──────────
    const fallbackPriorTopic = priorTopic || conversationHistory.slice(-1)[0]?.topic || null;
    const intent: IntentResult = buildHeuristicIntent(query, fallbackPriorTopic);

    // ── Step 2: The user already picked a chip (or declined) ─────
    if (forcedSearch === "none") {
      const chatResult = await generateChatResponse(req, query, language, conversationHistory, { forceOffer: false, blockOffer: true });
      return json({
        query,
        mode: "chat",
        quran_results: [],
        hadith_results: [],
        web_results: [],
        summary: chatResult.message,
        intent,
        meta: { found: false, quran_count: 0, hadith_count: 0 },
      });
    }

    if (forcedSearch === "quran" || forcedSearch === "hadith" || forcedSearch === "both" || forcedSearch === "islamweb") {
      const result = await handleSourceSearch(req, supabase, query, language, intent, conversationHistory, forcedSearch, phase, selectedOption);
      return json(result);
    }

    // ── Step 3: Direct numeric reference lookups (bypass chat) ───
    const quranRef = parseQuranReference(query);
    if (quranRef) {
      const { data, error } = await supabase
        .from("deen_quran_verses")
        .select("surah_number, ayah_number, surah_name_ar, surah_name_en, arabic_text, english_text")
        .eq("surah_number", quranRef.surah)
        .eq("ayah_number", quranRef.ayah)
        .maybeSingle();
      if (error) throw error;
      const quranResults: ResponseSource[] = data
        ? [{
          source_type: "quran",
          reference: `${data.surah_name_en} ${data.surah_number}:${data.ayah_number}`,
          title: language === "ar" ? data.surah_name_ar : data.surah_name_en,
          surah_number: data.surah_number,
          ayah_number: data.ayah_number,
          collection_id: null,
          hadith_number: null,
          text: language === "ar" ? data.arabic_text : data.english_text,
          translation: language === "ar" ? data.english_text : data.arabic_text,
          arabic_text: data.arabic_text,
          english_text: data.english_text,
          grade: "",
        }]
        : [];
      const evidence = quranResults.length > 0
        ? await generateEvidenceAnswer(req, query, language, conversationHistory, { quranResults, useWebSearch: false })
        : { summary: buildNoResultsSummary(language), web_results: [] };
      return json({
        query,
        mode: "evidence",
        quran_results: quranResults,
        hadith_results: [],
        web_results: [],
        summary: evidence.summary,
        intent,
        meta: { found: quranResults.length > 0, quran_count: quranResults.length, hadith_count: 0, sufficient: true },
      });
    }

    const hadithRef = parseHadithReference(query);
    if (hadithRef) {
      const { data, error } = await supabase
        .from("deen_hadith_entries")
        .select("collection_id, hadith_number, english_text, arabic_text, grade")
        .eq("collection_id", hadithRef.collectionId)
        .eq("hadith_number", hadithRef.hadithNumber)
        .maybeSingle();
      if (error) throw error;
      let result: ResponseSource[] = [];
      if (data) {
        const { data: collection } = await supabase
          .from("deen_hadith_collections")
          .select("name_en, name_ar")
          .eq("collection_id", hadithRef.collectionId)
          .maybeSingle();
        result = [{
          source_type: "hadith",
          reference: `${collection?.name_en ?? hadithRef.collectionId} #${data.hadith_number}`,
          title: language === "ar" ? collection?.name_ar || collection?.name_en || hadithRef.collectionId : collection?.name_en || hadithRef.collectionId,
          surah_number: null,
          ayah_number: null,
          collection_id: data.collection_id,
          hadith_number: data.hadith_number,
          text: language === "ar" && data.arabic_text ? data.arabic_text : data.english_text,
          translation: language === "ar" ? data.english_text || "" : data.arabic_text || "",
          arabic_text: data.arabic_text || "",
          english_text: data.english_text || "",
          grade: data.grade || "",
        }];
      }
      const evidence = result.length > 0
        ? await generateEvidenceAnswer(req, query, language, conversationHistory, { hadithResults: result, useWebSearch: false })
        : { summary: buildNoResultsSummary(language), web_results: [] };
      return json({
        query,
        mode: "evidence",
        quran_results: [],
        hadith_results: result,
        web_results: [],
        summary: evidence.summary,
        intent,
        meta: { found: result.length > 0, quran_count: 0, hadith_count: result.length, sufficient: true },
      });
    }

    // ── Step 4: Default — chat like an Islamic buddy ──────────────
    // Every question is answered from knowledge first. The AI decides whether to offer search.
    const chatResult = await generateChatResponse(req, query, language, conversationHistory, { forceOffer: false, blockOffer: false });

    return json({
      query,
      mode: chatResult.mode,
      quran_results: [],
      hadith_results: [],
      web_results: [],
      summary: chatResult.message,
      search_options: chatResult.search_options,
      intent,
      meta: { found: false, quran_count: 0, hadith_count: 0 },
    });
  } catch (error) {
    console.error("[deen-search]", error);
    return json({ error: "internal_error" }, 500);
  }
});
