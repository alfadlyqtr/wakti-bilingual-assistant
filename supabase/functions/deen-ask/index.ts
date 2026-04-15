import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const HADITH_API_BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const QURAN_API_BASE = "https://api.alquran.cloud/v1";
const COLLECTIONS = [
  { id: "bukhari", nameEn: "Sahih al-Bukhari", nameAr: "صحيح البخاري" },
  { id: "muslim", nameEn: "Sahih Muslim", nameAr: "صحيح مسلم" },
  { id: "abudawud", nameEn: "Sunan Abu Dawud", nameAr: "سنن أبي داود" },
  { id: "tirmidhi", nameEn: "Jami at-Tirmidhi", nameAr: "جامع الترمذي" },
  { id: "ibnmajah", nameEn: "Sunan Ibn Majah", nameAr: "سنن ابن ماجه" },
  { id: "nasai", nameEn: "Sunan an-Nasa'i", nameAr: "سنن النسائي" },
] as const;

type Scope = "quran" | "hadith" | "both" | "auto";
type SourceKind = "quran" | "hadith";

interface EvidenceItem {
  type: SourceKind;
  title: string;
  reference: string;
  text: string;
  translation?: string;
}

interface HadithApiItem {
  hadithnumber?: number;
  text?: string;
  grades?: { grade?: string; graded_by?: string }[];
}

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
    .replace(/[^\p{L}\p{N}\s:]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(value: string, limit = 560) {
  const text = value.trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
}

function isArabicText(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function detectScope(question: string, requested: Scope): Exclude<Scope, "auto"> {
  if (requested !== "auto") return requested;
  const q = normalizeText(question);
  if (/\bquran\b|\bverse\b|آية|قرآن/.test(q)) return "quran";
  if (/\bhadith\b|حديث|بخاري|مسلم|ترمذي|نسائي|ابن ماجه|أبو داود/.test(q)) return "hadith";
  return "both";
}

function parseQuranReference(question: string): { surah: number; ayah: number } | null {
  const match = question.match(/(?:^|\s)(\d{1,3})\s*[:/]\s*(\d{1,3})(?:\s|$)/);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return { surah, ayah };
}

function parseHadithReference(question: string): { collectionId: string; hadithNumber: number } | null {
  const q = normalizeText(question);
  for (const collection of COLLECTIONS) {
    const aliases = [collection.id, normalizeText(collection.nameEn), normalizeText(collection.nameAr)];
    if (aliases.some((alias) => alias && q.includes(alias))) {
      const match = q.match(/(?:#|رقم|number\s*)\s*(\d{1,6})|(\d{1,6})/);
      const raw = match?.[1] ?? match?.[2];
      const hadithNumber = Number(raw);
      if (hadithNumber > 0) return { collectionId: collection.id, hadithNumber };
    }
  }
  return null;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchQuranAyah(reference: { surah: number; ayah: number }, language: "ar" | "en"): Promise<EvidenceItem[]> {
  const english = await fetchJson(`${QURAN_API_BASE}/ayah/${reference.surah}:${reference.ayah}/en.sahih`);
  const arabic = await fetchJson(`${QURAN_API_BASE}/ayah/${reference.surah}:${reference.ayah}/quran-uthmani`);
  const englishData = english?.data;
  const arabicData = arabic?.data;
  if (!englishData || !arabicData) return [];
  const result: EvidenceItem = {
    type: "quran",
    title: language === "ar" ? "القرآن الكريم" : "Quran",
    reference: `${englishData?.surah?.englishName ?? "Quran"} ${reference.surah}:${reference.ayah}`,
    text: language === "ar" ? arabicData.text ?? "" : englishData.text ?? arabicData.text ?? "",
    translation: language === "ar" ? englishData.text ?? "" : arabicData.text ?? "",
  };
  return result.text.trim().length > 0 ? [result] : [];
}

async function searchQuran(question: string, language: "ar" | "en"): Promise<EvidenceItem[]> {
  const directRef = parseQuranReference(question);
  if (directRef) return fetchQuranAyah(directRef, language);

  const query = question.trim();
  if (!query) return [];

  const edition = isArabicText(query) || language === "ar" ? "quran-uthmani" : "en.sahih";
  const searchRes = await fetchJson(`${QURAN_API_BASE}/search/${encodeURIComponent(query)}/all/${edition}`);
  const matches = Array.isArray(searchRes?.data?.matches) ? searchRes.data.matches.slice(0, 3) : [];
  const results: EvidenceItem[] = [];

  for (const match of matches) {
    const surah = Number(match?.surah?.number ?? 0);
    const ayah = Number(match?.numberInSurah ?? 0);
    if (!surah || !ayah) continue;
    const exactItems = await fetchQuranAyah({ surah, ayah }, language);
    results.push(...exactItems);
  }

  return results.slice(0, 3);
}

async function fetchHadithByReference(reference: { collectionId: string; hadithNumber: number }, language: "ar" | "en"): Promise<EvidenceItem[]> {
  const editionPrefix = language === "ar" ? "ara" : "eng";
  const collection = COLLECTIONS.find((item) => item.id === reference.collectionId);
  const payload = await fetchJson(`${HADITH_API_BASE}/${editionPrefix}-${reference.collectionId}/${reference.hadithNumber}.json`);
  const item = payload?.hadiths ?? payload?.hadith ?? payload;
  const text = item?.text ?? "";
  if (!text.trim()) return [];

  return [{
    type: "hadith",
    title: language === "ar" ? collection?.nameAr ?? "حديث" : collection?.nameEn ?? "Hadith",
    reference: `${collection?.nameEn ?? reference.collectionId} #${reference.hadithNumber}`,
    text,
  }];
}

async function searchHadith(question: string, language: "ar" | "en"): Promise<EvidenceItem[]> {
  const directRef = parseHadithReference(question);
  if (directRef) {
    try {
      return await fetchHadithByReference(directRef, language);
    } catch (_error) {
      return [];
    }
  }

  const query = normalizeText(question);
  if (!query) return [];

  const editionPrefix = language === "ar" ? "ara" : "eng";
  const collectionPayloads = await Promise.all(
    COLLECTIONS.map(async (collection) => {
      try {
        const data = await fetchJson(`${HADITH_API_BASE}/${editionPrefix}-${collection.id}.json`);
        return { collection, hadiths: Array.isArray(data?.hadiths) ? data.hadiths as HadithApiItem[] : [] };
      } catch (_error) {
        return { collection, hadiths: [] as HadithApiItem[] };
      }
    })
  );

  const scored: Array<EvidenceItem & { score: number }> = [];
  for (const payload of collectionPayloads) {
    for (const hadith of payload.hadiths) {
      const text = hadith?.text ?? "";
      const normalized = normalizeText(text);
      if (!normalized || !normalized.includes(query)) continue;
      const index = normalized.indexOf(query);
      const score = index === 0 ? 1000 : Math.max(1, 1000 - index) + Math.min(text.length, 500);
      scored.push({
        score,
        type: "hadith",
        title: language === "ar" ? payload.collection.nameAr : payload.collection.nameEn,
        reference: `${payload.collection.nameEn} #${Number(hadith?.hadithnumber ?? 0)}`,
        text,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(({ score: _score, ...item }) => item);
}

async function generateGroundedAnswer(req: Request, question: string, language: "ar" | "en", evidence: EvidenceItem[]) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("missing_openai_key");

  const evidenceText = evidence.map((item, index) => {
    return [
      `Source ${index + 1}`,
      `Type: ${item.type}`,
      `Title: ${item.title}`,
      `Reference: ${item.reference}`,
      `Text: ${item.text}`,
      item.translation ? `Translation: ${item.translation}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const system = language === "ar"
    ? `أنت مساعد إسلامي في Wakti. أجب فقط من المصادر المسترجعة أدناه. لا تخترع أي دليل. إذا كانت الأدلة غير كافية فقل ذلك بوضوح. إذا كان السؤال عن حكم شرعي فاذكر أن الجواب للتعلم والفهم فقط وأن الفتوى النهائية عند الأوقاف أو عالم موثوق. أخرج JSON صارم بهذا الشكل: {"answer":"...","quran_summary":"...","hadith_summary":"..."}`
    : `You are Wakti's Islamic grounded answer assistant. Answer only from the retrieved sources below. Never invent evidence. If the evidence is insufficient, say so clearly. If the question is about a religious ruling, remind the user that this is for learning and understanding only and final fatwa guidance should come from local Awqaf or a trusted scholar. Output strict JSON in this shape: {"answer":"...","quran_summary":"...","hadith_summary":"..."}`;

  const userPrompt = `${language === "ar" ? "السؤال" : "Question"}: ${question}\n\n${language === "ar" ? "المصادر المسترجعة" : "Retrieved sources"}:\n${evidenceText}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
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

  const jsonPayload = await resp.json();
  const parsed = JSON.parse(jsonPayload?.choices?.[0]?.message?.content || "{}");

  await logAIFromRequest(req, {
    functionName: "deen-ask",
    provider: "openai",
    model: "gpt-4o-mini",
    inputText: userPrompt,
    outputText: parsed?.answer ?? "",
    status: "success",
    metadata: { evidence_count: evidence.length },
  });

  return parsed;
}

async function explainProvidedSource(
  req: Request,
  payload: { question: string; source_type?: string; source_ref?: string; source_text?: string; language: "ar" | "en" }
) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("missing_openai_key");

  const system = payload.language === "ar"
    ? "أنت مساعد شرح إسلامي مبسط في Wakti. اشرح النص المرسل فقط دون اختراع مصادر أخرى. اجعل الشرح واضحاً ومباشراً وقصيراً. أخرج JSON صارم بهذا الشكل: {\"answer\":\"...\"}."
    : "You are Wakti's Islamic source explainer. Explain only the provided source text without inventing other sources. Keep it clear, direct, and concise. Output strict JSON in this shape: {\"answer\":\"...\"}.";

  const userPrompt = `Question: ${payload.question}\nType: ${payload.source_type ?? "source"}\nReference: ${payload.source_ref ?? ""}\nSource text: ${payload.source_text ?? ""}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
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

  const jsonPayload = await resp.json();
  const parsed = JSON.parse(jsonPayload?.choices?.[0]?.message?.content || "{}");

  await logAIFromRequest(req, {
    functionName: "deen-ask",
    provider: "openai",
    model: "gpt-4o-mini",
    inputText: userPrompt,
    outputText: parsed?.answer ?? "",
    status: "success",
    metadata: { mode: "explain_source" },
  });

  return {
    answer: parsed?.answer ?? "",
    source_ref: payload.source_ref ?? "",
    quran_results: [],
    hadith_results: [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const language = body?.language === "ar" ? "ar" : "en";
    const question = (body?.question ?? "").toString().trim();
    const scope = (body?.scope ?? body?.source_type ?? "auto") as Scope;
    const sourceText = (body?.source_text ?? "").toString().trim();
    const sourceRef = (body?.source_ref ?? "").toString().trim();

    if (!question) return json({ error: "missing_question" }, 400);

    if (sourceText) {
      const explained = await explainProvidedSource(req, {
        question,
        source_type: body?.source_type,
        source_ref: sourceRef,
        source_text: sourceText,
        language,
      });
      return json(explained);
    }

    const resolvedScope = detectScope(question, scope);
    const quranResults = resolvedScope === "quran" || resolvedScope === "both"
      ? await searchQuran(question, language)
      : [];
    const hadithResults = resolvedScope === "hadith" || resolvedScope === "both"
      ? await searchHadith(question, language)
      : [];
    const evidence = [...quranResults, ...hadithResults].slice(0, 6);

    if (evidence.length === 0) {
      return json({
        answer: language === "ar"
          ? "لم أجد دليلاً واضحاً من القرآن أو الحديث لهذا الطلب بصيغته الحالية. حاول كتابة الكلمات المفتاحية بشكل أبسط أو أدخل مرجعاً مباشراً مثل 2:255 أو Bukhari 1."
          : "I could not find a clear Quran or Hadith match for this request yet. Try simpler keywords or use a direct reference like 2:255 or Bukhari 1.",
        quran_summary: "",
        hadith_summary: "",
        quran_results: [],
        hadith_results: [],
      });
    }

    const ai = await generateGroundedAnswer(req, question, language, evidence);
    return json({
      answer: ai?.answer ?? "",
      quran_summary: ai?.quran_summary ?? "",
      hadith_summary: ai?.hadith_summary ?? "",
      quran_results: quranResults.map((item) => ({
        ...item,
        text: trimText(item.text),
        translation: item.translation ? trimText(item.translation, 320) : "",
      })),
      hadith_results: hadithResults.map((item) => ({
        ...item,
        text: trimText(item.text),
      })),
      source_ref: evidence[0]?.reference ?? "",
    });
  } catch (error) {
    await logAIFromRequest(req, {
      functionName: "deen-ask",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    console.error("[deen-ask] error", error);
    return json({ error: "internal_error" }, 500);
  }
});
