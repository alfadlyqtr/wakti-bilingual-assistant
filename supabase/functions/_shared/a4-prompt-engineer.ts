// A4 Document Builder — Gemini Prompt Engineer Layer
// -----------------------------------------------------------------------------
// Role: a tightly controlled "Prompt Engineer" that turns the structured UI
// brief into one beautiful, subject-anchored final prompt for Nano Banana 2.
//
// Guardrails:
//   - It receives a structured JSON brief (not raw mess).
//   - It MUST return strict JSON (no prose, no markdown fences).
//   - It MUST respect decorations_unwanted, language_mode, theme, and must
//     preserve user content verbatim when input_mode="content_ready".
//   - If it misbehaves or fails, the caller uses the deterministic fallback.
// -----------------------------------------------------------------------------

import { generateGemini, type GeminiContent } from "./gemini.ts";

// =============================================================================
// Universal decoration chips (EN + AR labels)
// Exposed so backend + frontend stay in sync if the frontend imports the list.
// =============================================================================
export interface A4DecorChip {
  id: string;
  label_en: string;
  label_ar: string;
}

export const A4_UNIVERSAL_DECOR_CHIPS: A4DecorChip[] = [
  { id: "geometric_shapes", label_en: "geometric shapes", label_ar: "أشكال هندسية" },
  { id: "botanical_leaves", label_en: "botanical leaves", label_ar: "أوراق نباتية" },
  { id: "floral_accents", label_en: "floral accents", label_ar: "لمسات زهور" },
  { id: "arabic_motifs", label_en: "arabic / islamic motifs", label_ar: "زخارف عربية" },
  { id: "gold_foil", label_en: "gold foil accents", label_ar: "لمسات ذهبية" },
  { id: "paper_texture", label_en: "soft paper texture", label_ar: "ملمس ورقي ناعم" },
  { id: "watercolor_wash", label_en: "watercolor wash", label_ar: "رذاذ ألوان مائية" },
  { id: "hand_drawn_lines", label_en: "hand-drawn lines", label_ar: "خطوط يدوية" },
  { id: "ribbons_banners", label_en: "ribbons and banners", label_ar: "شرائط ولافتات" },
  { id: "stars_sparkles", label_en: "stars and sparkles", label_ar: "نجوم وبريق" },
  { id: "corner_ornaments", label_en: "corner ornaments", label_ar: "زخارف الزوايا" },
  { id: "line_icons", label_en: "minimalist line icons", label_ar: "أيقونات خطية بسيطة" },
  { id: "flat_illustrations", label_en: "flat illustrations", label_ar: "رسومات مسطحة" },
  { id: "abstract_waves", label_en: "abstract waves", label_ar: "موجات تجريدية" },
  { id: "dotted_dividers", label_en: "dotted dividers", label_ar: "فواصل منقطة" },
  { id: "grid_background", label_en: "subtle grid background", label_ar: "خلفية شبكية خفيفة" },
  { id: "confetti", label_en: "confetti accents", label_ar: "قصاصات احتفالية" },
  { id: "paper_tape", label_en: "paper tape strips", label_ar: "شرائط ورقية" },
  { id: "thread_connectors", label_en: "thread connectors", label_ar: "خيوط رابطة" },
  { id: "callout_badges", label_en: "callout badges", label_ar: "شارات ملاحظات" },
  { id: "soft_gradient", label_en: "soft color gradient", label_ar: "تدرج لوني ناعم" },
  { id: "marble_accent", label_en: "marble accent", label_ar: "لمسة رخامية" },
  { id: "vintage_stamps", label_en: "vintage stamps", label_ar: "طوابع قديمة" },
  { id: "photographic_imagery", label_en: "photographic imagery", label_ar: "صور فوتوغرافية" },
  { id: "3d_renders", label_en: "3d rendered elements", label_ar: "عناصر ثلاثية الأبعاد" },
  { id: "cartoon_characters", label_en: "cartoon characters", label_ar: "شخصيات كرتونية" },
  { id: "emoji_stickers", label_en: "emoji stickers", label_ar: "ملصقات إيموجي" },
  { id: "neon_glow", label_en: "neon glow effects", label_ar: "إضاءة نيون" },
  { id: "heavy_shadows", label_en: "heavy drop shadows", label_ar: "ظلال ثقيلة" },
  { id: "grunge_texture", label_en: "grunge texture", label_ar: "ملمس خشن" },
];

export const A4_MAX_CHIPS_PER_SIDE = 6;

// =============================================================================
// Types
// =============================================================================
export type A4InputMode = "content_ready" | "idea";

export interface A4PromptEngineerBrief {
  theme_id: string;
  theme_name: string;
  theme_style_summary: string;
  purpose_id: string | null;
  document_type_hint: string;
  language_mode: "en" | "ar" | "bilingual";
  orientation: "portrait" | "landscape";
  page_number: number;
  total_pages: number;
  input_mode: A4InputMode;
  subject_hint: string | null;
  title_hint: string | null;
  brand_name: string | null;
  brand_colors: { primary?: string | null; secondary?: string | null } | null;
  content: string;
  decorations_wanted: string[];
  decorations_unwanted: string[];
  creative_summary: string | null;
  has_logo_reference: boolean;
}

export interface A4PromptEngineerResult {
  subject: string;
  final_prompt: string;
  included_motifs: string[];
  excluded_motifs: string[];
}

// =============================================================================
// Gemini system instruction + schema
// =============================================================================
const SYSTEM_INSTRUCTION = `You are the WAKTI A4 Prompt Engineer. Your single job is to turn a structured brief into ONE beautiful, subject-anchored final prompt for the Nano Banana 2 image model so it produces a clean 2D A4 document image.

Hard rules — never violate:
1. Output STRICT JSON only. No prose. No markdown fences. No commentary.
2. Anchor the prompt to the real SUBJECT. Never produce generic "modern beautiful design" fluff.
3. Respect language_mode exactly: "en" = English only, "ar" = Arabic only, "bilingual" = both side-by-side.
4. Never include any motif listed in decorations_unwanted. Treat that list as absolute exclusions.
5. Include the motifs from decorations_wanted naturally, not as a bullet list.
6. When input_mode="content_ready", treat the provided content as source truth. Do NOT rewrite facts, numbers, names, or claims.
7. Produce a clean flat 2D A4 DOCUMENT. Never describe mockups, 3D renders, hands holding paper, desks, photographed scenes, folded corners, or isometric views.
8. Readability first. Typography must remain legible.
9. Keep the final prompt between 120 and 260 words — rich but not bloated.
10. Use positive framing. Describe what the design IS, not what it should avoid (except for the short exclusion line at the end).

The final prompt must naturally cover:
- Subject opener (what this document is about)
- Document type feel (report, flyer, menu, certificate, brief, etc.)
- Theme styling mood
- Layout guidance (header / body / footer or clear zones)
- Decorative language from decorations_wanted
- A short explicit exclusion line derived from decorations_unwanted
- Language requirement
- Instruction to render the provided content verbatim (when content_ready)
- Clean flat 2D A4 document rendering with readable typography

Return JSON with this exact shape:
{
  "subject": string,
  "final_prompt": string,
  "included_motifs": string[],
  "excluded_motifs": string[]
}`;

// =============================================================================
// Validation
// =============================================================================
function isValidResult(raw: unknown): raw is A4PromptEngineerResult {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  if (typeof r.subject !== "string" || !r.subject.trim()) return false;
  if (typeof r.final_prompt !== "string") return false;
  const fp = r.final_prompt.trim();
  if (fp.length < 200 || fp.length > 3500) return false;
  if (!Array.isArray(r.included_motifs)) return false;
  if (!Array.isArray(r.excluded_motifs)) return false;
  return true;
}

function violatesExclusions(finalPrompt: string, unwanted: string[]): string | null {
  const lower = finalPrompt.toLowerCase();
  for (const motif of unwanted) {
    const m = (motif || "").trim().toLowerCase();
    if (!m) continue;
    // Only flag when the motif appears in a positive context (no "no ", "without ", "avoid ")
    const idx = lower.indexOf(m);
    if (idx === -1) continue;
    const before = lower.slice(Math.max(0, idx - 20), idx);
    if (/\b(no|without|avoid|exclude|not|never)\s*$/.test(before)) continue;
    return motif;
  }
  return null;
}

// =============================================================================
// Prompt Engineer call
// =============================================================================
export async function runPromptEngineer(
  brief: A4PromptEngineerBrief,
): Promise<A4PromptEngineerResult | null> {
  try {
    const userPayload = {
      brief,
      instructions:
        "Engineer the single best final prompt for a clean flat 2D A4 document image. Respect every hard rule. Return strict JSON.",
    };
    const contents: GeminiContent[] = [
      {
        role: "user",
        parts: [{ text: JSON.stringify(userPayload) }],
      },
    ];

    const result = await generateGemini(
      "gemini-2.5-flash",
      contents,
      SYSTEM_INSTRUCTION,
      {
        temperature: 0.4,
        maxOutputTokens: 1800,
        response_mime_type: "application/json",
      },
    );

    const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      console.warn("[a4-prompt-engineer] empty response");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.warn("[a4-prompt-engineer] JSON parse failed:", (e as Error).message);
      return null;
    }
    if (!isValidResult(parsed)) {
      console.warn("[a4-prompt-engineer] invalid shape");
      return null;
    }
    const res = parsed as A4PromptEngineerResult;
    const violation = violatesExclusions(res.final_prompt, brief.decorations_unwanted);
    if (violation) {
      console.warn(`[a4-prompt-engineer] exclusion violation: ${violation}`);
      return null;
    }
    return res;
  } catch (e) {
    console.warn("[a4-prompt-engineer] call failed:", (e as Error).message);
    return null;
  }
}

// =============================================================================
// Idea expansion (separate small call, used by expand mode)
// =============================================================================
const EXPAND_SYSTEM_INSTRUCTION = `You expand a short user idea into usable document content for a WAKTI A4 document.

Rules:
1. Output STRICT JSON only: { "title": string, "content": string }.
2. Keep content between 90 and 420 words.
3. Write in the requested language_mode.
4. If language_mode is "bilingual", the title and content MUST be fully bilingual. Every major heading, bullet, or short paragraph must include both English and Arabic. Do not return mostly English with a few Arabic words, and do not return mostly Arabic with a few English words.
5. If language_mode is "bilingual", format the draft as compact paired lines that are easy to review and easy for the final generator to map into a bilingual layout.
6. Stay on topic. Do not invent brand names, statistics, prices, dates, or claims unless the user gave them.
7. Structure the content with short paragraphs or simple bullet lines that would naturally fit on an A4 page.
8. No markdown fences. No commentary.`;

export interface A4IdeaExpandRequest {
  idea: string;
  language_mode: "en" | "ar" | "bilingual";
  theme_name: string;
  purpose_id: string | null;
}

export interface A4IdeaExpandResult {
  title: string;
  content: string;
}

function countArabicChars(text: string): number {
  return (text.match(/[\u0600-\u06FF]/g) ?? []).length;
}

function countLatinChars(text: string): number {
  return (text.match(/[A-Za-z]/g) ?? []).length;
}

function isStrongBilingualDraft(result: A4IdeaExpandResult | null): boolean {
  if (!result) return false;
  const combined = `${result.title}\n${result.content}`;
  return countArabicChars(combined) >= 24 && countLatinChars(combined) >= 24;
}

async function requestIdeaExpand(
  req: A4IdeaExpandRequest,
  forceBilingual: boolean,
): Promise<A4IdeaExpandResult | null> {
  const payload = {
    request: req,
    output_requirements: req.language_mode === "bilingual"
      ? forceBilingual
        ? "CRITICAL: Return a fully bilingual draft. Every major heading, bullet, short paragraph, and the title must include both English and Arabic. Never return English-only content with a few Arabic words, and never return Arabic-only content."
        : "If language_mode is bilingual, return a fully bilingual draft with both English and Arabic throughout the title and content."
      : "Return content only in the requested language.",
  };

  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [{ text: JSON.stringify(payload) }],
    },
  ];

  const result = await generateGemini(
    "gemini-2.5-flash",
    contents,
    EXPAND_SYSTEM_INSTRUCTION,
    {
      temperature: 0.6,
      maxOutputTokens: 1400,
      response_mime_type: "application/json",
    },
  );
  const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const p = parsed as { content?: unknown; title?: unknown } | null;
  if (!p || typeof p.content !== "string" || !p.content.trim()) return null;
  return {
    title: typeof p.title === "string" ? p.title.trim() : "",
    content: String(p.content).trim(),
  };
}

export async function runIdeaExpand(
  req: A4IdeaExpandRequest,
): Promise<A4IdeaExpandResult | null> {
  try {
    let expanded = await requestIdeaExpand(req, false);
    if (req.language_mode === "bilingual" && !isStrongBilingualDraft(expanded)) {
      expanded = await requestIdeaExpand(req, true);
    }
    if (req.language_mode === "bilingual" && !isStrongBilingualDraft(expanded)) {
      return null;
    }
    return expanded;
  } catch (e) {
    console.warn("[a4-idea-expand] failed:", (e as Error).message);
    return null;
  }
}
