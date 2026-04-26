import { getThemeDocumentLane, getThemeFormSchema, type A4Theme } from "./a4-themes.ts";

export type A4Resolution = "1K" | "2K";

function detectLanguage(text: string): "en" | "ar" | "bilingual" {
  if (!text) return "en";
  const arabicRe = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const latinRe = /[A-Za-z]/g;
  const arabicCount = (text.match(arabicRe) ?? []).length;
  const latinCount = (text.match(latinRe) ?? []).length;
  if (arabicCount === 0) return "en";
  if (latinCount === 0) return "ar";
  const ratio = arabicCount / (arabicCount + latinCount);
  if (ratio > 0.8) return "ar";
  if (ratio < 0.2) return "en";
  return "bilingual";
}

function normalizeScalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "";
  if (Array.isArray(value)) return value.map((v) => normalizeScalar(v)).filter(Boolean).join(", ");
  return "";
}

function fieldLabel(
  labels: { en: string; ar: string },
  languageMode: "en" | "ar" | "bilingual",
): string {
  if (languageMode === "ar") return labels.ar;
  if (languageMode === "bilingual") return `${labels.en} / ${labels.ar}`;
  return labels.en;
}

function collectUserTextForDetection(formState: Record<string, unknown>): string {
  return Object.entries(formState)
    .filter(([key]) => !key.startsWith("__") && key !== "logo" && key !== "bilingual")
    .map(([, value]) => {
      if (typeof value === "boolean") return "";
      return normalizeScalar(value);
    })
    .filter(Boolean)
    .join("\n");
}

export function buildNormalizedA4Content(opts: {
  theme: A4Theme;
  purposeId?: string | null;
  formState: Record<string, unknown>;
  explicitLanguage?: "en" | "ar" | "bilingual" | null;
}): {
  content: string;
  detectedLanguage: "en" | "ar" | "bilingual";
  lane: "formal" | "visual";
} {
  const { theme, purposeId, formState, explicitLanguage } = opts;
  const lane = getThemeDocumentLane(theme.id, purposeId ?? null);
  const detectedLanguage = explicitLanguage ?? detectLanguage(collectUserTextForDetection(formState));
  const schema = getThemeFormSchema(theme, purposeId ?? null);
  const rawContent = normalizeScalar(formState.raw_content);
  const blocks: string[] = [];

  for (const field of schema) {
    if (
      field.key === "raw_content" ||
      field.key === "logo" ||
      field.key === "bilingual" ||
      field.key.startsWith("__")
    ) {
      continue;
    }
    const value = formState[field.key];
    if (field.type === "image") continue;
    if (field.type === "toggle") {
      if (value === true) blocks.push(fieldLabel({ en: field.label_en, ar: field.label_ar }, detectedLanguage));
      continue;
    }
    const normalized = normalizeScalar(value);
    if (!normalized) continue;
    const label = fieldLabel({ en: field.label_en, ar: field.label_ar }, detectedLanguage);
    if (field.type === "textarea") {
      blocks.push(`${label}\n${normalized}`);
      continue;
    }
    blocks.push(`${label}: ${normalized}`);
  }

  if (lane === "formal") {
    const formalBlocks = blocks.slice();
    if (rawContent) {
      formalBlocks.push(rawContent);
    }
    return {
      content: formalBlocks.join("\n\n").trim(),
      detectedLanguage,
      lane,
    };
  }

  if (rawContent) {
    return {
      content: rawContent,
      detectedLanguage,
      lane,
    };
  }

  return {
    content: blocks.join("\n\n").trim(),
    detectedLanguage,
    lane,
  };
}

export function chooseA4Resolution(opts: {
  themeId: string;
  purposeId?: string | null;
  totalPages: 1 | 2 | 3;
  normalizedContent: string;
  formState: Record<string, unknown>;
}): A4Resolution {
  const lane = getThemeDocumentLane(opts.themeId, opts.purposeId ?? null);
  const text = opts.normalizedContent.trim();
  const lineCount = text ? text.split(/\n+/).filter(Boolean).length : 0;
  const length = text.length;
  const hasDenseTableSignals = Boolean(
    opts.formState.include_table ||
    opts.formState.include_chart ||
    opts.formState.include_grading_circle,
  );
  const purpose = String(opts.purposeId ?? "").toLowerCase();

  if (
    lane === "formal" ||
    opts.totalPages > 1 ||
    hasDenseTableSignals ||
    length >= 1200 ||
    lineCount >= 18 ||
    purpose === "report" ||
    purpose === "letter" ||
    purpose === "notice"
  ) {
    return "2K";
  }

  if (opts.themeId === "craft_infographic") {
    if (length >= 700 || lineCount >= 12 || purpose === "school" || purpose === "high_school" || purpose === "college_university") {
      return "2K";
    }
  }

  if (opts.themeId === "clean_minimal") {
    if (purpose === "flyer" || purpose === "anything") {
      return length >= 900 || lineCount >= 14 ? "2K" : "1K";
    }
  }

  if (opts.themeId === "event_flyer" || opts.themeId === "certificate" || opts.themeId === "thank_you_invitation_card") {
    return length >= 800 || lineCount >= 12 ? "2K" : "1K";
  }

  return "1K";
}
