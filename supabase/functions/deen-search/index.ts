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

type SourcePreference = "quran_only" | "hadith_only" | "both";

type IntentResult = {
  question_type: QuestionType;
  normalized_topic: string;       // clean Islamic topic, e.g. "zakat on worn gold jewelry"
  source_preference: SourcePreference;
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

function detectSourcePreference(query: string): SourcePreference {
  const normalized = normalizeText(query);
  if (/\b(quran|verse|ayah|surah)\b|قرآن|القران|آية|اية|سورة/.test(normalized)) return "quran_only";
  if (/\b(hadith|sunnah|bukhari|muslim|tirmidhi|nasai|ibn majah|abu dawud)\b|حديث|السنة|بخاري|مسلم|ترمذي|نسائي|ابن ماجه|أبو داود|ابو داود/.test(normalized)) return "hadith_only";
  return "both";
}

function detectQuestionType(query: string, priorTopic: string | null): QuestionType {
  const normalized = normalizeText(query);
  if (parseQuranReference(query) || parseHadithReference(query)) return "reference_lookup";
  if (/\b(halal|haram|allowed|forbidden|permissible|rule|ruling|obligatory|obligation|sin|invalid|valid|fatwa)\b|حلال|حرام|يجوز|لا يجوز|حكم|واجب|فرض|سنة|بدعة|ذنب/.test(normalized)) return "fiqh_question";
  if (/\b(divorce|talaq|apostasy|takfir|inheritance|custody|punishment)\b|طلاق|ردة|تكفير|ميراث|حضانة|حد/.test(normalized)) return "sensitive";
  if (priorTopic && /^(what about|and if|and what if|what if|can i|is it|does that|this|that|it|them|these|those|وماذا|طيب|واذا|وإذا|هل هذا|هل ذلك|هذا|ذلك|هي|هو)\b/.test(normalized)) return "followup";
  if (/\b(quran|hadith|sunnah|dua|supplication|say about|what does)\b|قرآن|حديث|دعاء|ماذا يقول|ما حكم/.test(normalized)) return "simple_evidence";
  return "general_islamic";
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
    source_preference: detectSourcePreference(query),
    likely_disputed: likelyDisputed,
    needs_caution: needsCaution,
    clarification_needed: false,
    followup_anchor: priorTopic || undefined,
  };
}

function buildSearchTerms(query: string, normalizedTopic: string, priorTopic: string | null) {
  const raw = normalizeText(query);
  const simplified = simplifyQuery(query);
  const topic = normalizeText(normalizedTopic);
  const terms = uniqueTerms([
    topic,
    simplified,
    raw,
  ]);

  if (priorTopic) {
    const anchor = normalizeText(priorTopic);
    const followupNeedle = simplifyQuery(query) || raw;
    if (anchor && followupNeedle) {
      terms.unshift(normalizeText(`${anchor} ${followupNeedle}`));
    }
  }

  return uniqueTerms(terms).filter((term) => term.length > 1);
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

async function generateGroundedSummary(
  req: Request,
  question: string,
  language: "ar" | "en",
  quranResults: ResponseSource[],
  hadithResults: ResponseSource[],
) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
  const allSources = [...quranResults, ...hadithResults].slice(0, 6);
  if (!GEMINI_API_KEY || allSources.length === 0) {
    return buildFallbackSummary(language, quranResults, hadithResults);
  }

  const evidenceBlock = allSources.map((item, index) => {
    const visibleText = item.english_text || item.text || item.arabic_text || "";
    const trimmedText = visibleText.length > 380 ? `${visibleText.slice(0, 380).trimEnd()}…` : visibleText;
    return `[${index + 1}] ${item.source_type.toUpperCase()} — ${item.reference}${item.grade ? ` (${item.grade})` : ""}\n${trimmedText}`;
  }).join("\n\n");

  const system = language === "ar"
    ? `أنت مساعد Deen Ask في Wakti. أجب فقط من المصادر المعروضة لك من القرآن والحديث. لا تستخدم أي مصدر خارجي. لا تذكر Google أو العلماء أو مواقع خارجية. إذا كانت الأدلة غير كافية فقل ذلك بوضوح. لا تضف سؤال متابعة. لا تستخدم markdown. أخرج JSON فقط بهذا الشكل: {"summary":"...","quran_summary":"","hadith_summary":""}`
    : `You are Wakti's Deen Ask assistant. Answer only from the Quran and Hadith sources shown to you. Do not use any outside source. Do not mention Google, scholars, or external websites. If the evidence is limited, say so clearly. Do not add a follow-up question. Do not use markdown. Output JSON only in this shape: {"summary":"...","quran_summary":"","hadith_summary":""}`;

  const userPrompt = language === "ar"
    ? `السؤال: ${question}\n\nالمصادر:\n${evidenceBlock}\n\nاكتب جواباً مباشراً وقصيراً ومفيداً، مرتبطاً بالنصوص فقط.`
    : `Question: ${question}\n\nSources:\n${evidenceBlock}\n\nWrite a direct, helpful answer tied only to these texts.`;

  const startedAt = Date.now();
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`summary_failed:${resp.status}:${errorText.slice(0, 200)}`);
    }

    const payload = await resp.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(rawText);
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : buildFallbackSummary(language, quranResults, hadithResults);

    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-2.0-flash",
      inputText: userPrompt,
      outputText: summary,
      durationMs: Date.now() - startedAt,
      status: "success",
      metadata: {
        mode: "local_source_summary",
        source_count: allSources.length,
      },
    });

    return summary;
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-search",
      provider: "google",
      model: "gemini-2.0-flash",
      inputText: userPrompt,
      outputText: buildFallbackSummary(language, quranResults, hadithResults),
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        mode: "local_source_summary",
        source_count: allSources.length,
      },
    });
    return buildFallbackSummary(language, quranResults, hadithResults);
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

    if (!query) return json({ error: "missing_query" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ── Step 1: Classify question with the Islamic brain ──────────
    const fallbackPriorTopic = priorTopic || conversationHistory.slice(-1)[0]?.topic || null;
    const intent: IntentResult = buildHeuristicIntent(query, fallbackPriorTopic);

    // ── Step 2: If too vague, return clarification prompt ─────────
    if (intent.clarification_needed && intent.clarification_prompt) {
      return json({
        query,
        quran_results: [],
        hadith_results: [],
        intent,
        clarify: intent.clarification_prompt,
        summary: intent.clarification_prompt,
        meta: { found: false, quran_count: 0, hadith_count: 0 },
      });
    }

    // ── Step 3: Direct reference lookups (bypass AI search) ──────
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
      const summary = quranResults.length > 0
        ? await generateGroundedSummary(req, query, language, quranResults, [])
        : buildNoResultsSummary(language);
      return json({
        query,
        quran_results: quranResults,
        hadith_results: [],
        summary,
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
      const summary = result.length > 0
        ? await generateGroundedSummary(req, query, language, [], result)
        : buildNoResultsSummary(language);
      return json({
        query,
        quran_results: [],
        hadith_results: result,
        summary,
        intent,
        meta: { found: result.length > 0, quran_count: 0, hadith_count: result.length, sufficient: true },
      });
    }

    // ── Step 4: Fast GIN FTS search ──
    const topic = intent.normalized_topic.trim();
    const searchTerms = buildSearchTerms(query, topic, fallbackPriorTopic);

    let rows: SearchRow[] = [];
    let usedQuery = topic;

    for (const term of searchTerms) {
      const { data, error } = await supabase.rpc("search_deen_fts", {
        query_text: term,
        result_limit: limit,
      });
      if (error) {
        console.error("[deen-search] FTS error:", error.message);
        break;
      }
      const found = Array.isArray(data) ? data as SearchRow[] : [];
      if (found.length > 0) { rows = found; usedQuery = term; break; }
    }

    // ── Step 5: Evidence-type filtering by question type ─────────
    // fiqh/sensitive: hadith is primary — if we have hadith, suppress weak Quran-only results
    // hadith_only preference: remove quran rows
    // quran_only preference: remove hadith rows
    if (intent.source_preference === "hadith_only") {
      rows = rows.filter((r) => r.source_type === "hadith");
    } else if (intent.source_preference === "quran_only") {
      rows = rows.filter((r) => r.source_type === "quran");
    } else if (intent.question_type === "fiqh_question" || intent.question_type === "sensitive") {
      const hadithRows = rows.filter((r) => r.source_type === "hadith");
      const quranRows = rows.filter((r) => r.source_type === "quran");
      // Only include quran results if we also have hadith — prevents weak quran matches from dominating fiqh answers
      if (hadithRows.length > 0) {
        // Keep top 2 quran + top 3 hadith for fiqh (hadith-weighted)
        rows = [...quranRows.slice(0, 2), ...hadithRows.slice(0, 3)];
      } else {
        rows = [...quranRows, ...hadithRows];
      }
    }

    const quranResults = rows.filter((r) => r.source_type === "quran").map((r) => mapSearchRow(r, language));
    const hadithResults = rows.filter((r) => r.source_type === "hadith").map((r) => mapSearchRow(r, language));

    // ── Step 6: Sufficiency signal ────────────────────────────────
    // A fiqh/sensitive question is only "sufficient" if we have direct hadith evidence
    const hasSufficientEvidence =
      intent.question_type === "reference_lookup" ||
      intent.question_type === "simple_evidence" ||
      intent.question_type === "general_islamic"
        ? rows.length > 0
        : hadithResults.length > 0; // fiqh/sensitive/followup requires hadith

    const summary = rows.length > 0
      ? await generateGroundedSummary(req, query, language, quranResults, hadithResults)
      : buildNoResultsSummary(language);

    return json({
      query,
      quran_results: quranResults,
      hadith_results: hadithResults,
      summary,
      intent,
      meta: {
        found: quranResults.length > 0 || hadithResults.length > 0,
        quran_count: quranResults.length,
        hadith_count: hadithResults.length,
        search_query: usedQuery,
        sufficient: hasSufficientEvidence,
      },
    });
  } catch (error) {
    console.error("[deen-search]", error);
    return json({ error: "internal_error" }, 500);
  }
});
