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
  buildNormalizedA4Content,
  chooseA4Resolution,
  type A4Resolution,
} from "../_shared/a4-document-logic.ts";
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
  // "auto" (F11) means: let the backend detect from the content. The
  // tri-state UI sends "en" | "ar" | "bilingual" | "auto".
  language_mode?: "en" | "ar" | "bilingual" | "auto";
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
  // Special short-circuits:
  //   mode="expand" runs Gemini idea-expansion only (no DB writes, no Kie).
  //   mode="retry_page" (F14) re-dispatches a single failed page row.
  mode?: "generate" | "expand" | "retry_page";
  idea_text?: string; // only used with mode="expand"
  row_id?: string; // only used with mode="retry_page"
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
// F6: Server-side cap. The frontend caps at 5 MB but a direct API caller
// could ship anything; reject before we decode + store.
const LOGO_MAX_BYTES = 8 * 1024 * 1024;
const LOGO_ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function uploadLogoFromDataUrl(
  svc: any,
  userId: string,
  batchId: string,
  dataUrl: string,
): Promise<{ signedUrl: string; storagePath: string } | { error: string } | null> {
  try {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) {
      console.warn("[a4-generate] logo data URL invalid");
      return { error: "Logo must be an image data URL" };
    }
    const mime = m[1].toLowerCase();
    if (!LOGO_ALLOWED_MIME.has(mime)) {
      return { error: `Logo MIME ${mime} not allowed (jpeg/png/webp only)` };
    }
    const b64 = m[2];
    // Approximate decoded byte size from base64 length (avoids decoding huge
    // payloads just to measure them).
    const approxBytes = Math.floor(b64.length * 0.75);
    if (approxBytes > LOGO_MAX_BYTES) {
      return { error: `Logo too large (${Math.round(approxBytes / 1024 / 1024)} MB; max 8 MB)` };
    }
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > LOGO_MAX_BYTES) {
      return { error: `Logo too large (${Math.round(bytes.byteLength / 1024 / 1024)} MB; max 8 MB)` };
    }
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
    return { error: (e as Error).message };
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

// F7: Kie's gpt-image-2 supports 2:3 and 3:2 directly. The earlier remap
// (2:3 -> 3:4) silently distorted A4 output. Pass through every supported
// ratio verbatim and only fall back to "auto" for unknown values.
function mapKieAspectRatio(aspectRatio: string): string {
  const supported = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"]);
  if (supported.has(aspectRatio)) return aspectRatio;
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
  resolution: A4Resolution;
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
        resolution: opts.resolution,
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

  // F10: Per-user rate limit. Cap distinct batches in the trailing hour to
  // protect Kie + Gemini cost. "expand" mode is also counted lightly because
  // it triggers a Gemini call. Service role bypasses RLS so we can count
  // accurately even though the user's JWT was used above.
  if (body.mode !== "expand") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent, error: rateErr } = await supabaseService
      .from("user_a4_documents")
      .select("batch_id", { count: "exact" })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);
    if (!rateErr && Array.isArray(recent)) {
      const distinctBatches = new Set(recent.map((r: any) => r.batch_id)).size;
      const HOURLY_BATCH_CAP = 12;
      if (distinctBatches >= HOURLY_BATCH_CAP) {
        return json(429, {
          success: false,
          error: `Hourly limit reached (${HOURLY_BATCH_CAP} documents/hour). Please try again later.`,
        });
      }
    }
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

  // ---------------------------------------------------------------------------
  // RETRY MODE (F14) — re-dispatch a single failed page row owned by the user.
  // Does not create new rows. Reuses the stashed internals on page 1 for prompt
  // compilation. For pages 2+, falls back to page 1's image as the style anchor
  // when it is already completed; otherwise dispatches as a text-to-image task.
  // ---------------------------------------------------------------------------
  if (body.mode === "retry_page") {
    const rowId = String(body.row_id ?? "").trim();
    if (!rowId) return json(400, { success: false, error: "row_id is required" });

    const { data: targetRow, error: rowErr } = await supabaseService
      .from("user_a4_documents")
      .select("*")
      .eq("id", rowId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowErr || !targetRow) {
      return json(404, { success: false, error: "Row not found or not yours" });
    }
    if (targetRow.status !== "failed") {
      return json(400, { success: false, error: `Cannot retry a row with status="${targetRow.status}"` });
    }

    // Load page 1 to recover full settings (slim rows for pages 2+ only carry the token).
    const { data: page1Row } = await supabaseService
      .from("user_a4_documents")
      .select("*")
      .eq("batch_id", targetRow.batch_id)
      .eq("page_number", 1)
      .maybeSingle();
    const sourceFs = (page1Row?.form_state as Record<string, unknown> | null)
      ?? (targetRow.form_state as Record<string, unknown> | null)
      ?? {};

    const stashedDesign = (sourceFs.__design_settings__ as A4DesignSettings | null) ?? null;
    const stashedCreative = (sourceFs.__creative_settings__ as A4CreativeSettings | null) ?? null;
    const stashedLang = sourceFs.__language_mode__;
    const langForRetry: "en" | "ar" | "bilingual" =
      stashedLang === "ar" || stashedLang === "bilingual" || stashedLang === "en"
        ? stashedLang
        : "en";
    const splitPagesArr = Array.isArray(sourceFs.__split_pages__)
      ? (sourceFs.__split_pages__ as string[])
      : [];
    const rawForRetry =
      splitPagesArr[targetRow.page_number - 1]
      ?? splitPagesArr[splitPagesArr.length - 1]
      ?? String(sourceFs.raw_content ?? "");
    const stashedRoleRaw = sourceFs.__reference_image_role__;
    const roleForRetry: A4ReferenceImageRole =
      stashedRoleRaw === "portrait" ||
      stashedRoleRaw === "logo" ||
      stashedRoleRaw === "product" ||
      stashedRoleRaw === "sample" ||
      stashedRoleRaw === "none"
        ? stashedRoleRaw as A4ReferenceImageRole
        : "logo";
    const stashedWishes = typeof sourceFs.__user_wishes__ === "string"
      ? (sourceFs.__user_wishes__ as string)
      : null;
    const decorWantedRetry = Array.isArray(sourceFs.__decor_wanted__)
      ? (sourceFs.__decor_wanted__ as string[])
      : [];
    const decorUnwantedRetry = Array.isArray(sourceFs.__decor_unwanted__)
      ? (sourceFs.__decor_unwanted__ as string[])
      : [];
    const callbackTokenRetry = String(sourceFs.__callback_token__ ?? "").trim();
    if (!callbackTokenRetry) {
      return json(500, { success: false, error: "Missing callback token; cannot retry safely" });
    }

    // Pull the logo URL from page 1 (stored there pre-success). Page 2+ rows
    // store the page 1 image URL in reference_image_url after success.
    const logoForRetry: string | null =
      (page1Row?.reference_image_url as string | null) ?? null;
    const page1ImageUrl: string | null =
      targetRow.page_number > 1 ? ((page1Row?.image_url as string | null) ?? null) : null;

    const compiled = compileMasterPrompt({
      theme,
      purposeId: targetRow.purpose_id ?? null,
      formState: sourceFs,
      rawContent: rawForRetry,
      pageNumber: targetRow.page_number,
      totalPages: targetRow.total_pages,
      languageMode: langForRetry,
      brandColors: null,
      hasLogoReference: !!logoForRetry,
      hasPrevPageReference: !!page1ImageUrl,
      designSettings: stashedDesign,
      creativeSettings: stashedCreative,
      userWishes: stashedWishes,
      referenceImageRole: roleForRetry,
      decorationsWanted: decorWantedRetry,
      decorationsUnwanted: decorUnwantedRetry,
    });

    const retryInputs: string[] = [];
    if (logoForRetry) retryInputs.push(logoForRetry);
    if (page1ImageUrl) retryInputs.push(page1ImageUrl);

    const retryCallbackUrl = buildCallbackUrl(SUPABASE_URL, targetRow.batch_id, targetRow.page_number, callbackTokenRetry);
    const retryDispatch = await dispatchKieTask({
      prompt: compiled,
      imageInputs: retryInputs,
      aspectRatio: targetRow.aspect_ratio || theme.aspect_ratio,
      callbackUrl: retryCallbackUrl,
      apiKey: KIE_API_KEY,
      resolution: targetRow.resolution === "2K" ? "2K" : "1K",
    });
    if ("error" in retryDispatch) {
      return json(502, { success: false, error: `Kie retry dispatch failed: ${retryDispatch.error}` });
    }
    await supabaseService
      .from("user_a4_documents")
      .update({
        kie_task_id: retryDispatch.taskId,
        compiled_prompt: compiled,
        status: "generating",
        error_message: null,
      })
      .eq("id", targetRow.id);
    return json(200, {
      success: true,
      batch_id: targetRow.batch_id,
      total_pages: targetRow.total_pages,
      detected_language: langForRetry,
      brand_colors: null,
      prompt_source: "deterministic",
      notes: "retry dispatched",
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
    if (uploaded && "error" in uploaded) {
      // F6: surface size/MIME failures to the caller instead of silently
      // dropping the logo — the user explicitly asked for it.
      return json(400, { success: false, error: uploaded.error });
    }
    if (uploaded && "signedUrl" in uploaded) {
      logoSignedUrl = uploaded.signedUrl;
    }

    // Brand colors only make sense when the attachment is actually a logo.
    // If the user uploaded a portrait / product / sample, skip extraction so
    // we don't pull accent colors from skin tones or product photography.
    if (body.logo_color_extract && referenceImageRole === "logo" && logoSignedUrl) {
      brandColors = await extractBrandColors(body.logo_data_url);
    }
  }

  // --- Direct pipeline: detect language + split content (no AI middleman) ----
  // F11: when the UI passes "auto" (or omits the field) we run the unicode
  // detector on the actual content. Otherwise honor the explicit choice.
  const explicit: "en" | "ar" | "bilingual" | null =
    body.language_mode === "en" || body.language_mode === "ar" || body.language_mode === "bilingual"
      ? body.language_mode
      : null;
  const normalized = buildNormalizedA4Content({
    theme,
    purposeId: body.purpose_id ?? null,
    formState: rawFormState,
    explicitLanguage: explicit,
  });
  const rawContent = normalized.content;
  const detectedLanguage: "en" | "ar" | "bilingual" = normalized.detectedLanguage;

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
  const selectedResolution = chooseA4Resolution({
    themeId: theme.id,
    purposeId: body.purpose_id ?? null,
    totalPages,
    normalizedContent: rawContent,
    formState: rawFormState,
  });

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

  // F13: Lightweight moderation log for free-text user wishes. Logged to
  // edge-function logs only — not stored in DB — so abuse can be reviewed
  // without exposing the raw text in user-readable surfaces. Truncated to
  // keep logs manageable.
  if (userWishes) {
    const sample = userWishes.slice(0, 200).replace(/\s+/g, " ");
    console.log(`[a4-generate] user_wishes user=${user.id} len=${userWishes.length} sample="${sample}"`);
  }

  // Stash creative_settings + split pages inside form_state internal keys so
  // a4-callback can recompile pages 2+ without a schema change.
  const creativeSettings = body.creative_settings ?? null;
  const callbackToken = crypto.randomUUID();
  // F12: Page 1 stores the FULL internals (split pages, settings, wishes,
  // chips). Pages 2+ store only what their callback needs to validate the
  // token and look up page 1 — no duplicated split text. The callback
  // already fetches page 1's form_state for prompt compilation.
  const fullInternals: Record<string, unknown> = {
    ...formState,
    __creative_settings__: creativeSettings,
    __split_pages__: splitPages,
    __language_mode__: detectedLanguage,
    __resolution__: selectedResolution,
    __decor_wanted__: decorWanted,
    __decor_unwanted__: decorUnwanted,
    __input_mode__: inputMode,
    __callback_token__: callbackToken,
    // NEW — stash so a4-callback can reuse when compiling pages 2+
    __user_wishes__: userWishes,
    __reference_image_role__: referenceImageRole,
  };
  const slimInternals: Record<string, unknown> = {
    __callback_token__: callbackToken,
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
      form_state: i === 1 ? fullInternals : slimInternals,
      gemini_output: null,
      status: i === 1 ? "generating" : "queued",
      aspect_ratio: resolvedAspect,
      resolution: selectedResolution,
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
    // F1: forward user-picked decoration chips into the prompt.
    decorationsWanted: decorWanted,
    decorationsUnwanted: decorUnwanted,
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
    resolution: selectedResolution,
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
