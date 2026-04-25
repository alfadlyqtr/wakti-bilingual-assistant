// deno-lint-ignore-file no-explicit-any
// A4 Document Builder — Generate Edge Function
// -----------------------------------------------------------------------------
// Flow:
//   1. Auth check (JWT required).
//   2. Validate input, look up theme.
//   3. If logo provided as data URL: upload to a4-documents bucket, get public URL.
//   4. If logo_color_extract requested: call Gemini vision for dominant accent colors.
//   5. Call Gemini preprocess (gemini-2.5-flash-lite, JSON mode) to:
//        - clean raw_content
//        - decide/honor page count (1-3)
//        - split content into pages
//        - emit structured layout blocks
//   6. Insert one row per page (batch_id, page_number, status=queued).
//   7. Compile master prompt for page 1 and dispatch Kie createTask.
//   8. Return { batch_id, total_pages, ... } to frontend for Realtime subscription.
//
// Pages 2+ are dispatched from a4-callback after page 1 completes (chained).
// -----------------------------------------------------------------------------

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { generateGemini, buildVisionContent } from "../_shared/gemini.ts";
import { findTheme, maxPagesForTheme, themeRequiresPurpose } from "../_shared/a4-themes.ts";
import {
  compileMasterPrompt,
  type A4CreativeSettings,
  type A4DesignSettings,
  type A4ReferenceImageRole,
} from "../_shared/a4-prompts.ts";
import {
  runIdeaExpand,
  A4_MAX_CHIPS_PER_SIDE,
  type A4InputMode,
} from "../_shared/a4-prompt-engineer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateRequest {
  theme_id: string;
  purpose_id?: string | null;
  form_state: Record<string, unknown>;
  logo_data_url?: string | null; // base64 data URL uploaded from client
  logo_color_extract?: boolean;
  requested_pages?: "auto" | 1 | 2 | 3;
  language_mode?: "en" | "ar" | "bilingual";
  design_settings?: A4DesignSettings | null;
  creative_settings?: A4CreativeSettings | null;
  // --- Prompt Engineer controls (new) --------------------------------------
  input_mode?: A4InputMode; // "content_ready" | "idea"
  decorations_wanted?: string[];
  decorations_unwanted?: string[];
  // NEW — guaranteed-obedience controls ------------------------------------
  // Free-text user wishes. Injected VERBATIM into the compiled prompt so the
  // user's explicit intent always reaches the image model.
  user_wishes?: string | null;
  // Role of the uploaded reference image. Drives the REFERENCE IMAGE ROLE
  // directive in the compiled prompt (portrait / logo / product / sample).
  reference_image_role?: A4ReferenceImageRole | null;
  // Special short-circuit: when mode="expand" we only run Gemini idea-expansion
  // and return { title, content } without touching the DB or Kie.
  mode?: "generate" | "expand";
  idea_text?: string; // only used with mode="expand"
}

const KIE_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_TEXT_MODEL = "gpt-image-2-text-to-image";
const KIE_IMAGE_MODEL = "gpt-image-2-image-to-image";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
// Upload logo data URL to a4-documents bucket
// -----------------------------------------------------------------------------
async function uploadLogoFromDataUrl(
  svc: any,
  userId: string,
  batchId: string,
  dataUrl: string,
): Promise<{ signedUrl: string; storagePath: string } | null> {
  try {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) {
      console.warn("[a4-generate] logo data URL invalid");
      return null;
    }
    const mime = m[1];
    const b64 = m[2];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const storagePath = `${userId}/${batchId}/logo.${ext}`;
    const { error: upErr } = await svc.storage
      .from("a4-documents")
      .upload(storagePath, bytes, { contentType: mime, upsert: true });
    if (upErr) {
      console.error("[a4-generate] logo upload error:", upErr);
      return null;
    }
    const { data: signed, error: signErr } = await svc.storage
      .from("a4-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
    if (signErr || !signed) {
      console.error("[a4-generate] logo signed URL error:", signErr);
      return null;
    }
    return { signedUrl: signed.signedUrl, storagePath };
  } catch (e) {
    console.error("[a4-generate] uploadLogoFromDataUrl error:", (e as Error).message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Gemini vision color extraction (optional)
// -----------------------------------------------------------------------------
async function extractBrandColors(
  logoDataUrl: string,
): Promise<{ primary?: string; secondary?: string } | null> {
  try {
    const m = logoDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1];
    const b64 = m[2];

    const systemInstruction =
      "You extract dominant brand accent colors from a logo image. Return STRICT JSON only, no prose, no markdown fences.";
    const userPrompt =
      "Analyze this logo and return 1 or 2 dominant BRAND accent hex colors (avoid pure white, black, or neutral grays). Return JSON exactly: { \"primary\": \"#RRGGBB\", \"secondary\": \"#RRGGBB\" | null }. If extraction is unreliable, return { \"primary\": null, \"secondary\": null }.";

    const contents = [buildVisionContent(userPrompt, [{ mimeType: mime, base64: b64 }])];
    const result = await generateGemini("gemini-2.5-flash-lite", contents, systemInstruction, {
      temperature: 0.1,
      maxOutputTokens: 100,
      response_mime_type: "application/json",
    });
    const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) return null;
    const parsed = JSON.parse(text);
    const ok = (v: unknown) =>
      typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
    const primary = ok(parsed.primary);
    const secondary = ok(parsed.secondary);
    if (!primary && !secondary) return null;
    return { primary: primary ?? undefined, secondary: secondary ?? undefined };
  } catch (e) {
    console.warn("[a4-generate] brand color extract failed:", (e as Error).message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Language detection — simple unicode scan, no AI.
// -----------------------------------------------------------------------------
function detectLanguage(text: string): "en" | "ar" | "bilingual" {
  if (!text) return "en";
  // Arabic unicode ranges: Arabic (0600-06FF), Arabic Supplement (0750-077F), Arabic Extended-A (08A0-08FF), Arabic Presentation Forms (FB50-FDFF, FE70-FEFF)
  const arabicRe = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const latinRe = /[A-Za-z]/g;
  const arabicCount = (text.match(arabicRe) ?? []).length;
  const latinCount = (text.match(latinRe) ?? []).length;
  if (arabicCount === 0) return "en";
  if (latinCount === 0) return "ar";
  // Both present: if one dominates heavily, pick it; otherwise bilingual.
  const ratio = arabicCount / (arabicCount + latinCount);
  if (ratio > 0.8) return "ar";
  if (ratio < 0.2) return "en";
  return "bilingual";
}

// -----------------------------------------------------------------------------
// Content splitter — deterministic, paragraph-boundary split for multi-page.
// -----------------------------------------------------------------------------
function splitContentIntoPages(rawContent: string, pageCount: 1 | 2 | 3, perPageBudget: number): string[] {
  const trimmed = (rawContent ?? "").trim();
  if (pageCount <= 1 || !trimmed) return [trimmed];

  // Prefer splitting at blank-line paragraph boundaries; fall back to single-newline; finally hard-split on char count.
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [trimmed];

  // Accumulate paragraphs into buckets of ~perPageBudget chars until we fill pageCount buckets.
  const buckets: string[] = Array.from({ length: pageCount }, () => "");
  let idx = 0;
  for (const para of paragraphs) {
    const candidate = buckets[idx] ? `${buckets[idx]}\n\n${para}` : para;
    if (candidate.length > perPageBudget && idx < pageCount - 1 && buckets[idx].length > 0) {
      idx++;
      buckets[idx] = para;
    } else {
      buckets[idx] = candidate;
    }
  }
  // Remove empty trailing buckets
  while (buckets.length > 0 && !buckets[buckets.length - 1].trim()) buckets.pop();
  return buckets.length === 0 ? [trimmed] : buckets;
}

function mapKieAspectRatio(aspectRatio: string): string {
  if (aspectRatio === "2:3") return "3:4";
  if (aspectRatio === "3:2") return "4:3";
  if (
    aspectRatio === "1:1"
    || aspectRatio === "3:4"
    || aspectRatio === "4:3"
    || aspectRatio === "9:16"
    || aspectRatio === "16:9"
  ) {
    return aspectRatio;
  }
  return "auto";
}

function buildCallbackUrl(
  supabaseUrl: string,
  batchId: string,
  pageNumber: number,
  callbackToken: string,
): string {
  const url = new URL(`${supabaseUrl}/functions/v1/a4-callback`);
  url.searchParams.set("batch_id", batchId);
  url.searchParams.set("page", String(pageNumber));
  url.searchParams.set("token", callbackToken);
  return url.toString();
}

// -----------------------------------------------------------------------------
// Kie createTask dispatch
// -----------------------------------------------------------------------------
async function dispatchKieTask(opts: {
  prompt: string;
  imageInputs: string[];
  aspectRatio: string;
  callbackUrl: string;
  apiKey: string;
}): Promise<{ taskId: string } | { error: string }> {
  try {
    const hasImageInputs = opts.imageInputs.length > 0;
    const payload = {
      model: hasImageInputs ? KIE_IMAGE_MODEL : KIE_TEXT_MODEL,
      callBackUrl: opts.callbackUrl,
      input: {
        prompt: opts.prompt,
        ...(hasImageInputs ? { input_urls: opts.imageInputs } : {}),
        aspect_ratio: mapKieAspectRatio(opts.aspectRatio),
        ...(!hasImageInputs ? { resolution: "1K" } : {}),
      },
    };
    const resp = await fetch(KIE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await resp.text();
    console.log(`[a4-generate] Kie createTask HTTP:${resp.status} body:${raw.slice(0, 400)}`);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: `Kie non-JSON response (HTTP ${resp.status})` };
    }
    if (parsed?.code !== 200 || !parsed?.data?.taskId) {
      return { error: parsed?.msg || `Kie error code ${parsed?.code}` };
    }
    return { taskId: String(parsed.data.taskId) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// -----------------------------------------------------------------------------
// HANDLER
// -----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    return json(500, { success: false, error: "Supabase env not configured" });
  }
  if (!KIE_API_KEY) {
    return json(500, { success: false, error: "KIE_API_KEY not configured" });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { success: false, error: "Missing auth token" });

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json(401, { success: false, error: "Invalid auth token" });
  }
  const user = userData.user;

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Parse input
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: "Invalid JSON body" });
  }

  const theme = findTheme(body.theme_id);
  if (!theme) {
    return json(400, { success: false, error: `Unknown theme_id: ${body.theme_id}` });
  }

  // ---------------------------------------------------------------------------
  // EXPAND MODE — just call Gemini idea-expansion and return { title, content }.
  // No DB writes, no Kie dispatch. Used by the "I have just an idea" UI flow
  // to produce an editable preview before generation.
  // ---------------------------------------------------------------------------
  if (body.mode === "expand") {
    const idea = String(body.idea_text ?? "").trim();
    if (!idea) {
      return json(400, { success: false, error: "idea_text is required for expand mode" });
    }
    const languageMode: "en" | "ar" | "bilingual" =
      body.language_mode === "ar" ? "ar" : body.language_mode === "bilingual" ? "bilingual" : "en";
    const expanded = await runIdeaExpand({
      idea,
      language_mode: languageMode,
      theme_name: theme.name_en,
      purpose_id: body.purpose_id ?? null,
    });
    if (!expanded) {
      return json(502, { success: false, error: "Idea expansion failed" });
    }
    return json(200, {
      success: true,
      title: expanded.title,
      content: expanded.content,
    });
  }

  // Validate purpose chip if theme requires one
  const requiresPurpose = themeRequiresPurpose(theme);
  if (requiresPurpose) {
    if (!body.purpose_id) {
      return json(400, { success: false, error: "purpose_id is required for this theme" });
    }
    const validIds = theme.purpose_chips!.map((p) => p.id);
    if (!validIds.includes(body.purpose_id)) {
      return json(400, {
        success: false,
        error: `Invalid purpose_id. Must be one of: ${validIds.join(", ")}`,
      });
    }
  }

  const rawFormState = body.form_state ?? {};
  const designSettings = body.design_settings ?? null;
  // Stash design settings inside form_state so page 2+ callback can reuse them without a schema change
  const formState = designSettings
    ? { ...rawFormState, __design_settings__: designSettings }
    : rawFormState;
  const rawContent = String((rawFormState as any).raw_content ?? "");
  const languageMode: "en" | "ar" | "bilingual" =
    body.language_mode === "ar" ? "ar" : body.language_mode === "bilingual" ? "bilingual" : "en";
  const requestedPages = body.requested_pages ?? "auto";
  const maxPages = maxPagesForTheme(theme);

  // Resolved aspect ratio honoring user orientation override
  const resolvedAspect = (() => {
    const o = designSettings?.orientation;
    if (!o || o === "portrait") return theme.aspect_ratio;
    if (o === "landscape") {
      if (theme.aspect_ratio === "2:3") return "3:2";
      if (theme.aspect_ratio === "3:4") return "4:3";
      return "3:2";
    }
    return theme.aspect_ratio;
  })();

  // Batch ID for this document
  const batchId = crypto.randomUUID();

  // --- Guaranteed-obedience inputs (needed before logo/color extraction) ----
  // user_wishes is free-text, injected verbatim into the compiled prompt.
  // reference_image_role tells the image model how to use the attachment.
  const userWishes = String(body.user_wishes ?? "").trim().slice(0, 2000) || null;
  const allowedRoles: A4ReferenceImageRole[] = ["portrait", "logo", "product", "sample", "none"];
  const referenceImageRole: A4ReferenceImageRole = allowedRoles.includes(
    body.reference_image_role as A4ReferenceImageRole,
  )
    ? (body.reference_image_role as A4ReferenceImageRole)
    : "logo"; // safe default — preserves legacy behavior when UI doesn't send one

  // --- Upload logo if provided -----------------------------------------------
  let logoSignedUrl: string | null = null;
  let brandColors: { primary?: string; secondary?: string } | null = null;
  if (body.logo_data_url) {
    const uploaded = await uploadLogoFromDataUrl(
      supabaseService,
      user.id,
      batchId,
      body.logo_data_url,
    );
    if (uploaded) logoSignedUrl = uploaded.signedUrl;

    // Brand colors only make sense when the attachment is actually a logo.
    // If the user uploaded a portrait / product / sample, skip extraction so
    // we don't pull accent colors from skin tones or product photography.
    if (body.logo_color_extract && referenceImageRole === "logo") {
      brandColors = await extractBrandColors(body.logo_data_url);
    }
  }

  // --- Direct pipeline: detect language + split content (no AI middleman) ----
  // Honor explicit language_mode from the client; else detect from raw content.
  const detectedLanguage: "en" | "ar" | "bilingual" = body.language_mode
    ? languageMode
    : detectLanguage(rawContent);

  // Decide page count: explicit requested_pages wins, otherwise auto-estimate
  // from content length against the theme's per-page budget.
  let totalPages: 1 | 2 | 3;
  if (requestedPages === "auto") {
    const estimate = Math.max(1, Math.ceil((rawContent.length || 1) / Math.max(400, theme.per_page_char_budget)));
    totalPages = Math.min(maxPages, Math.min(3, estimate)) as 1 | 2 | 3;
  } else {
    totalPages = Math.min(maxPages, requestedPages as 1 | 2 | 3) as 1 | 2 | 3;
  }

  // Split content deterministically at paragraph boundaries.
  const splitPages = splitContentIntoPages(rawContent, totalPages, theme.per_page_char_budget);
  // If splitter produced fewer buckets than totalPages (short content), clamp.
  if (splitPages.length > 0 && splitPages.length < totalPages) {
    totalPages = splitPages.length as 1 | 2 | 3;
  }

  // Sanitize decoration chips (cap at max per side, trim, filter empty/dupes)
  const sanitizeChips = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of arr) {
      const v = String(raw ?? "").trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
      if (out.length >= A4_MAX_CHIPS_PER_SIDE) break;
    }
    return out;
  };
  const decorWanted = sanitizeChips(body.decorations_wanted);
  const decorUnwanted = sanitizeChips(body.decorations_unwanted);
  const inputMode: A4InputMode = body.input_mode === "idea" ? "idea" : "content_ready";

  // Stash creative_settings + split pages inside form_state internal keys so
  // a4-callback can recompile pages 2+ without a schema change.
  const creativeSettings = body.creative_settings ?? null;
  const callbackToken = crypto.randomUUID();
  const formStateWithInternals: Record<string, unknown> = {
    ...formState,
    __creative_settings__: creativeSettings,
    __split_pages__: splitPages,
    __language_mode__: detectedLanguage,
    __decor_wanted__: decorWanted,
    __decor_unwanted__: decorUnwanted,
    __input_mode__: inputMode,
    __callback_token__: callbackToken,
    // NEW — stash so a4-callback can reuse when compiling pages 2+
    __user_wishes__: userWishes,
    __reference_image_role__: referenceImageRole,
  };

  // --- Insert N placeholder rows ---------------------------------------------
  const fs = formState as Record<string, unknown>;
  const titleForMeta = String(
    fs.project_title ?? fs.report_title ?? fs.event_name ?? fs.title ?? fs.subject ?? "A4 Document",
  ).slice(0, 200);

  const rowsToInsert = [];
  for (let i = 1; i <= totalPages; i++) {
    rowsToInsert.push({
      user_id: user.id,
      batch_id: batchId,
      page_number: i,
      total_pages: totalPages,
      theme_id: theme.id,
      purpose_id: body.purpose_id ?? null,
      form_state: formStateWithInternals,
      gemini_output: null,
      status: i === 1 ? "generating" : "queued",
      aspect_ratio: resolvedAspect,
      resolution: "1K",
      title: titleForMeta,
      reference_image_url: null,
    });
  }

  const { data: insertedRows, error: insErr } = await supabaseService
    .from("user_a4_documents")
    .insert(rowsToInsert)
    .select("id, page_number");

  if (insErr || !insertedRows) {
    console.error("[a4-generate] insert error:", insErr);
    return json(500, { success: false, error: "Failed to create document rows" });
  }

  const page1Row = insertedRows.find((r) => r.page_number === 1);
  if (!page1Row) return json(500, { success: false, error: "Page 1 row missing" });

  // --- Compile master prompt for page 1 (DETERMINISTIC — OBEDIENT) ----------
  // The Gemini "Prompt Engineer" was removed from the generation path because
  // it was dropping user content and paraphrasing facts. The deterministic
  // compiler is guaranteed to embed the raw content verbatim plus every
  // structured input the user provided (theme, design, creative, decorations,
  // user wishes, reference image role). What the user picks IS what the
  // image model sees.
  const compiledPrompt = compileMasterPrompt({
    theme,
    purposeId: body.purpose_id ?? null,
    formState,
    rawContent: splitPages[0] ?? rawContent,
    pageNumber: 1,
    totalPages,
    languageMode: detectedLanguage,
    brandColors: brandColors ?? null,
    hasLogoReference: !!logoSignedUrl,
    hasPrevPageReference: false,
    designSettings: designSettings,
    creativeSettings,
    userWishes,
    referenceImageRole,
  });
  const promptSource = "deterministic" as const;

  // Dispatch Kie createTask for page 1
  const callbackUrl = buildCallbackUrl(SUPABASE_URL, batchId, 1, callbackToken);
  const kieResult = await dispatchKieTask({
    prompt: compiledPrompt,
    imageInputs: logoSignedUrl ? [logoSignedUrl] : [],
    aspectRatio: resolvedAspect,
    callbackUrl,
    apiKey: KIE_API_KEY,
  });

  if ("error" in kieResult) {
    await supabaseService
      .from("user_a4_documents")
      .update({ status: "failed", error_message: kieResult.error })
      .eq("batch_id", batchId);
    return json(502, { success: false, error: `Kie dispatch failed: ${kieResult.error}` });
  }

  // Update page 1 row with prompt + task id
  await supabaseService
    .from("user_a4_documents")
    .update({
      kie_task_id: kieResult.taskId,
      compiled_prompt: compiledPrompt,
      reference_image_url: logoSignedUrl, // store logo ref for pages 2+ to reuse
    })
    .eq("id", page1Row.id);

  return json(200, {
    success: true,
    batch_id: batchId,
    total_pages: totalPages,
    suggested_pages: totalPages,
    detected_language: detectedLanguage,
    brand_colors: brandColors,
    prompt_source: promptSource,
    notes: "",
  });
});
