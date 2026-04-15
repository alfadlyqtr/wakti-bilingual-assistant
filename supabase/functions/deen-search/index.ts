import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function classifyQuestion(
  query: string,
  priorTopic: string | null,
  conversationHistory: ConversationTurn[],
  language: "ar" | "en",
  geminiKey: string,
): Promise<IntentResult> {
  const convoBlock = conversationHistory.length > 0
    ? conversationHistory.map((t) =>
        `User asked: "${t.question}"\nTopic was: ${t.topic || 'unknown'}\nAnswer snippet: ${t.answer.slice(0, 150)}`
      ).join("\n---\n")
    : "none";

  const prompt = `You are an Islamic AI assistant. Classify this question and output ONLY valid JSON, no other text:
{
  "question_type": "reference_lookup"|"simple_evidence"|"fiqh_question"|"followup"|"sensitive"|"general_islamic",
  "normalized_topic": "clean Islamic search terms in English for database lookup",
  "source_preference": "quran_only"|"hadith_only"|"both",
  "likely_disputed": false,
  "needs_caution": false,
  "clarification_needed": false,
  "clarification_prompt": null,
  "followup_anchor": null
}
Rules:
- fiqh_question: ruling/permissibility/halal/haram/obligation
- sensitive: apostasy, divorce, punishments, inheritance
- reference_lookup: specific verse or hadith by reference number
- simple_evidence: what does Quran/hadith say about X
- general_islamic: general knowledge, explanation, story, dua request
- followup: continuation of the conversation below — user is asking more about the SAME topic
- normalized_topic: CRITICAL — this is used for database full-text search. Generate the BEST possible search keywords.
  * Include the core Islamic concept in English: "prayer fajr missed sleeping", "patience sabr trials"
  * For follow-ups: COMBINE the prior topic with the new request. Example: prior topic was "feeling far from Allah" and user says "give me a dua" → normalized_topic should be "dua supplication closeness to Allah repentance"
  * For Quran questions: include "quran" + the topic. Example: "What does the Quran say about patience?" → "patience sabr quran trials hardship"
  * Always include Arabic transliteration of key terms: sabr, tawbah, salah, zakat, etc.
- source_preference: "hadith_only" if user explicitly says "give me a hadith", "quran_only" if asks specifically for Quran verse, else "both"
- followup_anchor: if this is a follow-up, set this to the prior topic so we can search with context
- Prior topic: ${priorTopic ? `"${priorTopic}"` : "none"}
- Conversation history:\n${convoBlock}
- Language: ${language}

Question: "${query}"

JSON only:`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 400, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`classify_failed:${resp.status}`);
    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    return {
      question_type: parsed.question_type ?? "general_islamic",
      normalized_topic: parsed.normalized_topic ?? query,
      source_preference: parsed.source_preference ?? "both",
      likely_disputed: parsed.likely_disputed ?? false,
      needs_caution: parsed.needs_caution ?? false,
      clarification_needed: parsed.clarification_needed ?? false,
      clarification_prompt: parsed.clarification_prompt ?? undefined,
      followup_anchor: parsed.followup_anchor ?? undefined,
    };
  } catch {
    clearTimeout(timer);
    throw new Error("classify_timeout_or_failed");
  }
}

const COLLECTION_ALIASES = [
  { id: "bukhari", aliases: ["bukhari", "al-bukhari", "albukhari", "بخاري", "البخاري"] },
  { id: "muslim", aliases: ["muslim", "مسلم", "صحيح مسلم"] },
  { id: "abudawud", aliases: ["abudawud", "abu dawud", "ابو داود", "أبو داود"] },
  { id: "tirmidhi", aliases: ["tirmidhi", "termedhi", "ترمذي", "الترمذي"] },
  { id: "ibnmajah", aliases: ["ibnmajah", "ibn majah", "ابن ماجه"] },
  { id: "nasai", aliases: ["nasai", "nasa'i", "نسائي", "النسائي"] },
] as const;

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


function mapSearchRow(row: SearchRow, language: "ar" | "en") {
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

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
    let intent: IntentResult;
    try {
      intent = await classifyQuestion(query, priorTopic, conversationHistory, language, GEMINI_API_KEY);
    } catch {
      intent = {
        question_type: "general_islamic",
        normalized_topic: query,
        source_preference: "both",
        likely_disputed: false,
        needs_caution: false,
        clarification_needed: false,
      };
    }

    // ── Step 2: If too vague, return clarification prompt ─────────
    if (intent.clarification_needed && intent.clarification_prompt) {
      return json({
        query,
        quran_results: [],
        hadith_results: [],
        intent,
        clarify: intent.clarification_prompt,
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
      const quranResults = data
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
      return json({
        query,
        quran_results: quranResults,
        hadith_results: [],
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
      let result: Record<string, unknown>[] = [];
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
      return json({
        query,
        quran_results: [],
        hadith_results: result,
        intent,
        meta: { found: result.length > 0, quran_count: 0, hadith_count: result.length, sufficient: true },
      });
    }

    // ── Step 4: Fast GIN FTS search ──
    const topic = intent.normalized_topic.trim();
    const searchTerms = [topic];
    if (topic.toLowerCase() !== query.toLowerCase()) searchTerms.push(query.trim());

    // For follow-ups, also try combined anchor + topic
    if (intent.followup_anchor) {
      const combined = `${intent.followup_anchor} ${topic}`.trim();
      if (!searchTerms.includes(combined)) searchTerms.unshift(combined);
    }

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

    return json({
      query,
      quran_results: quranResults,
      hadith_results: hadithResults,
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
