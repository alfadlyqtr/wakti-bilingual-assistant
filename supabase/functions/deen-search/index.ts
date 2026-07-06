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

type SearchOption = "quran" | "hadith";
type ForcedSearch = SearchOption | "both" | "none";

type ChatModeResult = {
  mode: "chat" | "offer_search";
  message: string;
  search_options: SearchOption[];
};

type EvidenceAnswerResult = {
  summary: string;
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

function userSentSalaam(text: string): boolean {
  const normalized = normalizeText(text);
  return /\b(?:as+[\s-]*salaa?m(?:u|o)?|salaa?m)[\s-]*a?l(?:a|e|i)(?:y|i)?k(?:u|o|i)m\b/i.test(normalized)
    || /(?:^|\s)(?:السلام\s*عليكم|سلام\s*عليكم)(?:\s|$)/u.test(text);
}

function stripWaAlaikumReply(text: string): string {
  return text
    .replace(/\bwa[\s-]*a?l(?:a|e|i)(?:y|i)?k(?:u|o|i)m(?:[\s-]*(?:a?s+[\s-]*)?salaa?m)?\b[،,.!?:;-]*/giu, "")
    .replace(/و\s*عليكم\s*السلام[،,.!?:؛-]*/gu, "")
    .replace(/^[\s،,.!?:;-]+/u, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureParagraphLayout(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length > 1) return paragraphs.join("\n\n");

  const single = paragraphs[0] || normalized;
  const sentences = single.match(/[^.!?؟]+[.!?؟]?/gu)?.map((part) => part.trim()).filter(Boolean) ?? [single];

  if (sentences.length <= 2) return single;

  const chunked: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunked.push(sentences.slice(i, i + 2).join(" ").trim());
  }

  return chunked.join("\n\n");
}

function formatAssistantMessage(rawText: string, fallbackText: string): string {
  const fallback = fallbackText.trim();
  let message = rawText.trim();

  if (!message) message = fallback;

  message = stripWaAlaikumReply(message);

  message = ensureParagraphLayout(message);

  if (!message) return fallback;
  return message;
}

function addSalaamReplyIfNeeded(message: string, language: "ar" | "en", question: string): string {
  if (!userSentSalaam(question)) return message;
  const greeting = language === "ar" ? "وعليكم السلام." : "Wa alaikum assalam.";
  const withoutReply = stripWaAlaikumReply(message);
  const combined = withoutReply ? `${greeting}\n\n${withoutReply}` : greeting;
  return ensureParagraphLayout(combined);
}

function uniqueTerms(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function detectQuestionType(query: string, priorTopic: string | null): QuestionType {
  const normalized = normalizeText(query);
  if (parseQuranReference(query) || parseHadithReference(query)) return "reference_lookup";
  if (/\b(quran|hadith|sunnah|proof|evidence|dalil|daleel|ayah|verse|sources?)\b|القرآن|القران|حديث|الحديث|السنة|سنة|دليل|أدلة|ادلة|آية|اية/.test(normalized)) return "simple_evidence";
  if (/\b(halal|haram|allowed|forbidden|permissible|rule|ruling|obligatory|obligation|sin|invalid|valid|fatwa)\b|حلال|حرام|يجوز|لا يجوز|حكم|واجب|فرض|سنة|بدعة|ذنب/.test(normalized)) return "fiqh_question";
  if (/\b(divorce|talaq|apostasy|takfir|inheritance|custody|punishment)\b|طلاق|ردة|تكفير|ميراث|حضانة|حد/.test(normalized)) return "sensitive";
  if (priorTopic && /^(what about|and if|and what if|what if|can i|is it|does that|this|that|it|them|these|those|وماذا|طيب|واذا|وإذا|هل هذا|هل ذلك|هذا|ذلك|هي|هو)\b/.test(normalized)) return "followup";
  return "general_islamic";
}

function sanitizeSearchOptions(value: unknown): SearchOption[] {
  if (!Array.isArray(value)) return [];
  const valid: SearchOption[] = ["quran", "hadith"];
  const out: SearchOption[] = [];
  for (const v of value) {
    if (typeof v === "string" && (valid as string[]).includes(v) && !out.includes(v as SearchOption)) {
      out.push(v as SearchOption);
    }
  }
  return out;
}

function containsSpecificEvidenceReference(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  const quranRef = /(?:\b(?:surah|sura|ayah|verse)\b[^\n]{0,28}\d{1,3}\s*[:/]\s*\d{1,3})|(?:\b\d{1,3}\s*[:/]\s*\d{1,3}\b)/iu;
  const hadithRef = /(?:\b(?:bukhari|muslim|tirmidhi|abu\s*dawud|ibn\s*majah|nasai|nasa'i)\b[^\n]{0,20}#?\s*\d+)|(?:\b(?:حديث|البخاري|مسلم|الترمذي|أبو\s*داود|ابو\s*داود|ابن\s*ماجه|النسائي)\b[^\n]{0,20}\d+)/iu;
  const quoteRef = /(?:قال\s+رسول\s+الله|the prophet\s*\(?peace be upon him\)?\s*said|allah\s+says|قال\s+الله)/iu;

  return quranRef.test(value) || hadithRef.test(value) || quoteRef.test(value);
}

function messageRequestsEvidenceLookup(text: string): boolean {
  const normalized = normalizeText(text);
  const lookupVerb = /\b(search|lookup|look up|check|verify|find|review)\b|ابحث|أبحث|تحقق|أتحقق|راجع|نراجع/u;
  const evidenceTarget = /\b(quran|hadith|sunnah|ayah|verse|sources?)\b|القرآن|القران|حديث|الحديث|السنة|سنة|آية|اية/u;
  return lookupVerb.test(normalized) && evidenceTarget.test(normalized);
}

function fallbackOfferMessage(language: "ar" | "en"): string {
  return language === "ar"
    ? [
      "أفهم سؤالك، ومن الجيد أنك تبحث عن جواب واضح ومطمئن.",
      "أقدّر قلقك، ومن الطبيعي أن تحتاج وضوحاً في مثل هذه المسائل.",
      "بشكل عام في الإسلام، الأفضل أن نتعامل مع هذه المسألة بهدوء وصدق، وأن نختار ما هو أقرب لطاعة الله دون التسرع في الحكم.",
      "هل تريد أن أبحث لك الآن في القرآن والحديث حول هذا السؤال؟",
    ].join("\n\n")
    : [
      "I understand your question, and it is good that you are seeking a clear and reassuring answer.",
      "I appreciate your concern, and it is natural to want clarity in matters like this.",
      "From a general Islamic view, this should be approached with sincerity, calm judgment, and what is closest to obedience to Allah without rushing to conclusions.",
      "Would you like me to search the Quran and Hadith sources for this now?",
    ].join("\n\n");
}

function fallbackChatMessage(language: "ar" | "en"): string {
  return language === "ar"
    ? [
      "أفهم سؤالك، ومن الجيد أنك تبحث عن جواب واضح ومطمئن.",
      "أقدّر قلقك، ومن الطبيعي أن تحتاج وضوحاً في مثل هذه المسائل.",
      "بشكل عام في الإسلام، الأفضل أن نتعامل مع هذه المسألة بهدوء وصدق، وأن نختار ما هو أقرب لطاعة الله دون التسرع في الحكم.",
    ].join("\n\n")
    : [
      "I understand your question, and it is good that you are seeking a clear and reassuring answer.",
      "I appreciate your concern, and it is natural to want clarity in matters like this.",
      "From a general Islamic view, this should be approached with sincerity, calm judgment, and what is closest to obedience to Allah without rushing to conclusions.",
    ].join("\n\n");
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

function buildHadithTopicSignals(topic: string): string[] {
  const normalizedTopic = normalizeText(topic);
  const baseTerms = simplifyQuery(topic).split(" ").map((t) => t.trim()).filter((t) => t.length > 1);
  const signals = new Set(baseTerms);

  const isTravelPrayerTopic = /\b(travel|travelling|traveling|traveler|traveller|journey|journeying|safar|musafir|qasr|shorten|shortened|combine|combined)\b|سفر|مسافر|قصر|جمع|صلاة\s*السفر|الصلاة\s*في\s*السفر/u.test(normalizedTopic);

  if (isTravelPrayerTopic) {
    [
      "travel",
      "travelling",
      "traveling",
      "traveler",
      "traveller",
      "journey",
      "journeying",
      "safar",
      "musafir",
      "qasr",
      "shorten",
      "shortened",
      "combine",
      "combined",
      "prayer",
      "salat",
      "salah",
      "salaah",
      "سفر",
      "مسافر",
      "قصر",
      "جمع",
      "صلاة",
      "الصلاة",
    ].forEach((term) => signals.add(term));
  }

  return Array.from(signals);
}

function scoreHadithRelevance(source: ResponseSource, topicSignals: string[]): number {
  if (topicSignals.length === 0) return 0;

  const haystack = normalizeText([
    source.reference,
    source.title,
    source.text,
    source.english_text,
    source.arabic_text,
  ].join(" "));

  if (!haystack) return 0;

  let score = 0;
  for (const signal of topicSignals) {
    if (signal.length <= 2) continue;
    if (haystack.includes(signal)) {
      score += signal.length >= 6 ? 2 : 1;
    }
  }

  const hasTravelWord = /(travel|travelling|traveling|traveler|traveller|journey|journeying|safar|musafir|سفر|مسافر)/u.test(haystack);
  const hasPrayerWord = /(prayer|salat|salah|salaah|صلاة|الصلاة)/u.test(haystack);
  const hasQasrCombineWord = /(qasr|shorten|shortened|combine|combined|قصر|جمع)/u.test(haystack);

  if (hasTravelWord && hasPrayerWord) score += 4;
  if (hasQasrCombineWord && hasPrayerWord) score += 3;

  return score;
}

function rankAndFilterHadithResults(topic: string, hadithResults: ResponseSource[]): ResponseSource[] {
  if (hadithResults.length <= 1) return hadithResults;

  const signals = buildHadithTopicSignals(topic);
  if (signals.length === 0) return hadithResults;

  const scored = hadithResults.map((item) => ({ item, score: scoreHadithRelevance(item, signals) }));
  const maxScore = Math.max(...scored.map((entry) => entry.score));

  if (maxScore <= 0) return hadithResults;

  const filtered = scored
    .filter((entry) => entry.score >= Math.max(1, maxScore - 1))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  return filtered.length > 0 ? filtered : hadithResults;
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
    ? [
      "أفهم أن هذا السؤال مهم لك، ومن الطبيعي أن تبحث عن جواب يطمئنك.",
      "لم أجد تطابقاً واضحاً من القرآن والحديث بصياغة هذا السؤال، لذلك الأفضل أن تعرضه على الأوقاف المحلية. توضيح هذا الحكم مهم جداً حتى تكون عبادتك وقرارك مبنيين على فتوى موثوقة وواضحة.",
    ].join("\n\n")
    : [
      "I understand this question is important to you, and it makes sense that you want a clear answer.",
      "I could not find a clear Quran and Hadith match for this wording, so the best next step is to ask your local Awqaf. Clarifying this matter is important so your worship and decisions stay grounded on trusted guidance.",
    ].join("\n\n");
}

function buildFallbackSummary(language: "ar" | "en", quranResults: ResponseSource[], hadithResults: ResponseSource[]) {
  const firstQuran = quranResults[0];
  const firstHadith = hadithResults[0];
  if (language === "ar") {
    if (firstQuran && firstHadith) {
      return [
        "أفهم سؤالك، وبناءً على المصادر المعروضة ظهر دليل رئيسي من القرآن ودليل رئيسي من الحديث.",
        `أهم المراجع هنا: ${firstQuran.reference} و${firstHadith.reference}. هذان الدليلان يوجهان إلى معنى واحد واضح في المسألة دون توسع خارج النصوص المعروضة.`,
        "الخلاصة العملية القصيرة: اعمل بما هو أوضح من هذه الأدلة، واستفتِ أهل العلم الثقات في تفاصيل حالتك.",
      ].join("\n\n");
    }
    if (firstQuran) {
      return [
        "أفهم سؤالك، وبناءً على المصادر المعروضة ظهر دليل رئيسي من القرآن.",
        `أهم مرجع هنا: ${firstQuran.reference}. هذا المرجع يوضح الأصل الأقرب في المسألة بما يظهر من النص المعروض.`,
        "الخلاصة العملية القصيرة: اعمل بما هو أوضح من هذا الدليل، واستفتِ أهل العلم الثقات في تفاصيل حالتك.",
      ].join("\n\n");
    }
    if (firstHadith) {
      return [
        "أفهم سؤالك، وبناءً على المصادر المعروضة ظهر دليل رئيسي من الحديث.",
        `أهم مرجع هنا: ${firstHadith.reference}. هذا المرجع يوضح التوجيه العملي الأقرب في المسألة بما يظهر من النص المعروض.`,
        "الخلاصة العملية القصيرة: اعمل بما هو أوضح من هذا الدليل، واستفتِ أهل العلم الثقات في تفاصيل حالتك.",
      ].join("\n\n");
    }
    return buildNoResultsSummary(language);
  }

  if (firstQuran && firstHadith) {
    return [
      "I understand your question, and the shown sources provide one key Quran reference and one key Hadith reference.",
      `The main references here are ${firstQuran.reference} and ${firstHadith.reference}. Together, they point to one clear direction without going beyond the shown texts.`,
      "The short guidance is to act on what is clearest in these references and ask trusted local scholars for personal details.",
    ].join("\n\n");
  }
  if (firstQuran) {
    return [
      "I understand your question, and the shown sources provide one key Quran reference for it.",
      `The main reference here is ${firstQuran.reference}. It gives the clearest foundation for this issue based on the shown text.`,
      "The short guidance is to act on what is clearest in this reference and ask trusted local scholars for personal details.",
    ].join("\n\n");
  }
  if (firstHadith) {
    return [
      "I understand your question, and the shown sources provide one key Hadith reference for it.",
      `The main reference here is ${firstHadith.reference}. It gives the clearest practical direction for this issue based on the shown text.`,
      "The short guidance is to act on what is clearest in this reference and ask trusted local scholars for personal details.",
    ].join("\n\n");
  }
  return buildNoResultsSummary(language);
}

function buildChatSystemPrompt(language: "ar" | "en"): string {
  return language === "ar"
    ? `أنت "رفيق الدين" في تطبيق Wakti — صديق مسلم واعٍ يتحدث مع المستخدم بشكل طبيعي وودود. تتحدث فقط عن الإسلام: القرآن، الحديث، الفقه، التاريخ الإسلامي، العبادات، وحياة المسلم اليومية. إذا سأل المستخدم عن أي شيء خارج الإسلام، اعتذر بلطف ووجّه الحديث نحو موضوع إسلامي فقط.

عند الإجابة من المعرفة فقط (بدون بحث)، التزم بهذا الترتيب دائماً:
1) جملة فهم واضحة لسؤال المستخدم.
2) جملة تعاطف قصيرة فقط (لا تبالغ ولا تكرر التعاطف بكثرة).
3) نظرة إسلامية عامة مرتبطة بالسؤال، بدون تفاصيل مرجعية.
4) إذا كان الموضوع يحتاج دليلاً أو مزيد تحقق، اسأل المستخدم إن كان يريد البحث في القرآن والحديث.

ممنوع منعاً باتاً في إجابة المعرفة: ذكر نص آية محددة، أو نص حديث محدد، أو أرقام مراجع (مثل 2:255 أو Bukhari 1)، أو صياغات اقتباس مباشرة من النصوص.

إذا طلبت من المستخدم البحث في القرآن والحديث، يجب أن يكون mode هو offer_search دائماً، وتكون search_options هي ["quran","hadith"] فقط.

لا تذكر أبداً Google أو أي محرك بحث أو أي موقع خارجي.

لا تقل "وعليكم السلام" إلا إذا كانت رسالة المستخدم الحالية نفسها تحتوي تحية "السلام عليكم". لا تعتمد على التحيات الموجودة في سياق المحادثة السابقة.

أجب دائماً بلغة المستخدم، بدون Markdown، وفي فقرات قصيرة واضحة.

أخرج الرد فقط بهذا الشكل:
{"mode":"chat" أو "offer_search","message":"نص الرد","search_options":["quran","hadith"]}
اترك search_options فارغة [] عندما يكون mode = chat.`
    : `You are Wakti's Deen Buddy — a warm, knowledgeable Muslim friend having a real conversation with the user. You only discuss Islam: Quran, Hadith, fiqh, Islamic history, worship, and daily Muslim life. If the user asks about non-Islamic topics, gently decline and steer back to Islamic topics only.

When answering from knowledge only (without search), always follow this order:
1) A clear understanding sentence.
2) One short sympathy sentence (no over-sympathy and no repeated emotional lines).
3) A general Islamic perspective related to the question.
4) If the topic needs evidence or verification, ask whether the user wants a Quran and Hadith lookup.

Strictly forbidden in knowledge-only replies: quoting specific Quran verses, quoting specific Hadith, giving citation numbers (like 2:255 or Bukhari 1), or direct textual claims presented as sourced references.

If you ask the user whether to look up Quran and Hadith, mode must be offer_search and search_options must be ["quran","hadith"] only.

Never mention Google, search engines, or any external website.

Only say "Wa alaikum assalam" when the current user message itself includes a salam greeting. Never do this due to prior conversation context.

Always reply in the user's language, with no markdown, in clear short paragraphs.

Respond only in this JSON shape:
{"mode":"chat" or "offer_search","message":"reply text","search_options":["quran","hadith"]}
Leave search_options empty [] when mode = chat.`;
}

async function generateChatResponse(
  req: Request,
  question: string,
  language: "ar" | "en",
  conversationHistory: ConversationTurn[],
  opts: { forceOffer: boolean; blockOffer: boolean },
): Promise<ChatModeResult> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const fallbackOptions: SearchOption[] = ["quran", "hadith"];
  const fallbackChat = fallbackChatMessage(language);
  const fallbackOffer = fallbackOfferMessage(language);

  if (!GEMINI_API_KEY) {
    if (opts.forceOffer && !opts.blockOffer) {
      const formattedOffer = formatAssistantMessage(fallbackOffer, fallbackOffer);
      return {
        mode: "offer_search",
        message: addSalaamReplyIfNeeded(formattedOffer, language, question),
        search_options: fallbackOptions,
      };
    }
    const formattedChat = formatAssistantMessage(fallbackChat, fallbackChat);
    return {
      mode: "chat",
      message: addSalaamReplyIfNeeded(formattedChat, language, question),
      search_options: [],
    };
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
      : (mode === "offer_search" ? fallbackOffer : fallbackChat);
    let searchOptions = sanitizeSearchOptions(parsed?.search_options);

    if (containsSpecificEvidenceReference(message)) {
      message = mode === "offer_search" ? fallbackOffer : fallbackChat;
    }

    const asksLookup = messageRequestsEvidenceLookup(message);

    if (opts.blockOffer) {
      mode = "chat";
      searchOptions = [];
    } else if (opts.forceOffer || mode === "offer_search" || asksLookup) {
      mode = "offer_search";
      searchOptions = fallbackOptions;
      if (!messageRequestsEvidenceLookup(message)) {
        message = fallbackOffer;
      }
    } else {
      mode = "chat";
      searchOptions = [];
    }

    if (containsSpecificEvidenceReference(message)) {
      message = mode === "offer_search" ? fallbackOffer : fallbackChat;
    }

    message = formatAssistantMessage(message, mode === "offer_search" ? fallbackOffer : fallbackChat);
    message = addSalaamReplyIfNeeded(message, language, question);

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

    if (opts.forceOffer && !opts.blockOffer) {
      const formattedOffer = formatAssistantMessage(fallbackOffer, fallbackOffer);
      return {
        mode: "offer_search",
        message: addSalaamReplyIfNeeded(formattedOffer, language, question),
        search_options: fallbackOptions,
      };
    }
    const formattedChat = formatAssistantMessage(fallbackChat, fallbackChat);
    return {
      mode: "chat",
      message: addSalaamReplyIfNeeded(formattedChat, language, question),
      search_options: [],
    };
  }
}

function buildEvidenceSystemPrompt(language: "ar" | "en"): string {
  return language === "ar"
    ? `أنت "رفيق الدين" في تطبيق Wakti. طلب المستخدم منك التحقق من دليل حقيقي لسؤاله. أجب بأسلوب دافئ ومشجع كصديق مطّلع، معتمداً فقط على المصادر المعروضة أدناه من القرآن والحديث. لا تستخدم أي مصدر خارجي، ولا تذكر Google أو أي موقع.

التزم بهذا الشكل بدقة:
1) فقرة رئيسية قصيرة فيها فهم للسؤال وجواب مباشر.
2) فقرة قصيرة تلخّص أهم الأدلة فقط داخل نفس الجواب (ليس كل الأدلة): غالباً أهم آية وأهم حديث من المعروض.
3) بعد سطر فارغ، فقرة أخيرة قصيرة جداً للتوجيه العملي.

ممنوع تماماً إضافة أي عناوين أو تسميات مثل "ملخص الأحاديث" أو "ملخص الآيات" أو "خلاصة مجمعة". وممنوع القوائم النقطية أو الترقيم. لا تستخدم markdown. لا تضف سؤال متابعة.

سياق المحادثة السابقة للرجوع فقط. أخرج JSON فقط بهذا الشكل: {"summary":"..."}`
    : `You are Wakti's Deen Buddy. The user asked you to check real evidence for their question. Answer warmly and clearly, relying only on the Quran and Hadith sources shown below. Do not use outside sources, and do not mention Google or any website.

Follow this exact shape:
1) One short main paragraph showing understanding and a direct answer.
2) One short paragraph that summarizes only the key references inside the same answer (not all references): usually one main Quran reference and one main Hadith reference.
3) After one blank line, one very short final guidance paragraph.

Do not add any headings or labels such as "Hadith Reference Summary", "Quran Reference Summary", or "Combined Short Takeaway". No bullet points, no numbering, no markdown, and no follow-up question.

Previous conversation context is for reference only. Output JSON only in this shape: {"summary":"..."}`;
}

async function generateEvidenceAnswer(
  req: Request,
  question: string,
  language: "ar" | "en",
  conversationHistory: ConversationTurn[],
  options: {
    quranResults?: ResponseSource[];
    hadithResults?: ResponseSource[];
    topic?: string;
  },
): Promise<EvidenceAnswerResult> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const quranResults = options.quranResults ?? [];
  const hadithResults = options.hadithResults ?? [];
  const topic = options.topic?.trim() || question;
  const allSources = [...quranResults, ...hadithResults].slice(0, 6);
  const fallbackSummary = buildFallbackSummary(language, quranResults, hadithResults);

  if (allSources.length === 0) {
    return { summary: buildNoResultsSummary(language) };
  }

  if (!GEMINI_API_KEY) {
    const formattedFallback = formatAssistantMessage(fallbackSummary, fallbackSummary);
    return { summary: formattedFallback };
  }

  const evidenceBlock = allSources.length > 0
    ? allSources.map((item, index) => {
      const visibleText = item.english_text || item.text || item.arabic_text || "";
      const trimmedText = visibleText.length > 380 ? `${visibleText.slice(0, 380).trimEnd()}…` : visibleText;
      return `[${index + 1}] ${item.source_type.toUpperCase()} — ${item.reference}${item.grade ? ` (${item.grade})` : ""}\n${trimmedText}`;
    }).join("\n\n")
    : "";

  const system = buildEvidenceSystemPrompt(language);

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
      : fallbackSummary;
    const formattedSummary = formatAssistantMessage(summary, fallbackSummary);
    const finalSummary = formattedSummary;

    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: finalSummary,
      durationMs: Date.now() - startedAt,
      status: "success",
      metadata: { mode: "evidence_mode", source_count: allSources.length },
    });

    return { summary: finalSummary };
  } catch (error) {
    const formattedFallbackSummary = formatAssistantMessage(fallbackSummary, fallbackSummary);
    const finalFallbackSummary = formattedFallbackSummary;
    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-3.1-flash-lite",
      inputText: userPrompt,
      outputText: finalFallbackSummary,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { mode: "evidence_mode", source_count: allSources.length },
    });
    return { summary: finalFallbackSummary };
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
  sourceType: "quran" | "hadith" | "both",
): Promise<ClarificationOption[]> {
  const contextBlock = conversationHistory.length > 0
    ? language === "ar"
      ? `سياق المحادثة السابق:\n${conversationHistory.map((t, i) => `${i + 1}. ${t.question}`).join("\n")}\n\n`
      : `Previous conversation context:\n${conversationHistory.map((t, i) => `${i + 1}. ${t.question}`).join("\n")}\n\n`
    : "";

  const sourceLabel = sourceType === "quran" ? (language === "ar" ? "القرآن" : "Quran")
    : sourceType === "hadith" ? (language === "ar" ? "الحديث" : "Hadith")
    : (language === "ar" ? "القرآن والحديث" : "Quran & Hadith");

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
  searchType: "quran" | "hadith" | "both",
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

  let quranResults: ResponseSource[] = [];
  let hadithResults: ResponseSource[] = [];

  if (searchType === "quran" || searchType === "both") {
    const quranRefs = await findQuranReferences(req, topic, language);
    quranResults = await fetchQuranVerses(supabase, quranRefs, language);
  }

  if (searchType === "hadith" || searchType === "both") {
    const hadithRefs = await findHadithReferences(req, topic, language);
    hadithResults = await fetchHadithEntries(supabase, hadithRefs, language);
    hadithResults = rankAndFilterHadithResults(topic, hadithResults);
  }

  if (quranResults.length === 0 && hadithResults.length === 0) {
    const noResultsSummary = buildNoResultsSummary(language);
    return {
      query,
      mode: "chat",
      quran_results: [],
      hadith_results: [],
      web_results: [],
      summary: noResultsSummary,
      intent,
      meta: { found: false, quran_count: 0, hadith_count: 0, sufficient: false },
    };
  }

  const evidence = await generateEvidenceAnswer(req, query, language, conversationHistory, { quranResults, hadithResults });
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
    const forcedSearch: ForcedSearch | null = rawForcedSearch && ["quran", "hadith", "both", "none"].includes(rawForcedSearch)
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

    if (forcedSearch === "quran" || forcedSearch === "hadith" || forcedSearch === "both") {
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
        ? await generateEvidenceAnswer(req, query, language, conversationHistory, { quranResults })
        : { summary: buildNoResultsSummary(language) };
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
        ? await generateEvidenceAnswer(req, query, language, conversationHistory, { hadithResults: result })
        : { summary: buildNoResultsSummary(language) };
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
    const shouldForceOffer = intent.needs_caution || intent.likely_disputed || intent.question_type === "simple_evidence";
    const chatResult = await generateChatResponse(req, query, language, conversationHistory, { forceOffer: shouldForceOffer, blockOffer: false });

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
