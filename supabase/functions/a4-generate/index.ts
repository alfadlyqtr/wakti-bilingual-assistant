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
import { generateGemini, buildTextContent, buildVisionContent } from "../_shared/gemini.ts";
import { findTheme, maxPagesForTheme } from "../_shared/a4-themes.ts";
import {
  buildGeminiPreprocessSystemPrompt,
  buildGeminiPreprocessUserPayload,
  compileMasterPrompt,
  type A4PreprocessInput,
  type GeminiPage,
} from "../_shared/a4-prompts.ts";

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
  design_settings?: {
    orientation?: "portrait" | "landscape";
    background_color?: string | null;
    text_color?: string | null;
    accent_color?: string | null;
    font_family?: "modern_sans" | "classic_serif" | "elegant_script" | "bold_display" | "playful_hand";
    border_style?: "none" | "thin" | "thick" | "rounded" | "decorative";
    include_decorative_images?: boolean;
    density?: "compact" | "balanced" | "airy";
    tone?: "professional" | "friendly" | "playful" | "formal";
  } | null;
}

interface GeminiPreprocessOutput {
  status: "ok" | "too_long" | "content_unclear";
  detected_language: "en" | "ar" | "bilingual";
  suggested_pages: 1 | 2 | 3;
  honored_pages: 1 | 2 | 3;
  pages: GeminiPage[];
  notes_for_renderer?: string;
}

const KIE_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_MODEL = "nano-banana-2";

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
// Gemini preprocess
// -----------------------------------------------------------------------------
async function runGeminiPreprocess(input: A4PreprocessInput): Promise<GeminiPreprocessOutput> {
  const systemInstruction = buildGeminiPreprocessSystemPrompt();
  const userText = buildGeminiPreprocessUserPayload(input);
  const contents = [buildTextContent("user", userText)];
  const result = await generateGemini(
    "gemini-2.5-flash-lite",
    contents,
    systemInstruction,
    {
      temperature: 0.2,
      maxOutputTokens: 8000,
      response_mime_type: "application/json",
    },
  );
  const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini preprocess returned empty text");
  let parsed: GeminiPreprocessOutput;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[a4-generate] Gemini JSON parse error. Raw:", text.slice(0, 500));
    throw new Error("Gemini preprocess returned invalid JSON");
  }
  // Basic validation + clamping
  if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("Gemini preprocess returned no pages");
  }
  // Clamp pages to max 3
  if (parsed.pages.length > 3) parsed.pages = parsed.pages.slice(0, 3);
  if (parsed.honored_pages > 3) parsed.honored_pages = 3;
  if (parsed.honored_pages < 1) parsed.honored_pages = 1;
  // Ensure page_number fields are 1..N
  parsed.pages = parsed.pages.map((p, idx) => ({ ...p, page_number: idx + 1 }));
  return parsed;
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
    const payload = {
      model: KIE_MODEL,
      callBackUrl: opts.callbackUrl,
      input: {
        prompt: opts.prompt,
        image_input: opts.imageInputs,
        aspect_ratio: opts.aspectRatio,
        resolution: "1K",
        output_format: "jpg",
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

  // Validate purpose chip if theme requires one
  const requiresPurpose =
    !!theme.purpose_chips && !theme.form_schema_common && !theme.form_schema;
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

    if (body.logo_color_extract) {
      brandColors = await extractBrandColors(body.logo_data_url);
    }
  }

  // --- Gemini preprocess -----------------------------------------------------
  let gemini: GeminiPreprocessOutput;
  try {
    gemini = await runGeminiPreprocess({
      theme_id: theme.id,
      purpose_id: body.purpose_id ?? null,
      form_state: formState,
      raw_content: rawContent,
      language_mode: languageMode,
      requested_pages: requestedPages,
      per_page_char_budget: theme.per_page_char_budget,
      max_pages: maxPages,
    });
  } catch (e) {
    console.error("[a4-generate] preprocess error:", (e as Error).message);
    return json(500, { success: false, error: "Gemini preprocess failed" });
  }

  const totalPages = Math.min(gemini.honored_pages, maxPages) as 1 | 2 | 3;

  // --- Insert N placeholder rows ---------------------------------------------
  const fs = formState as any;
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
      form_state: formState,
      gemini_output: i === 1 ? gemini : null, // store full output only on page 1 for debug
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

  // --- Compile master prompt for page 1 --------------------------------------
  const compiledPrompt = compileMasterPrompt({
    theme,
    purposeId: body.purpose_id ?? null,
    formState,
    geminiPages: gemini.pages,
    pageNumber: 1,
    totalPages,
    languageMode,
    brandColors: brandColors ?? null,
    hasLogoReference: !!logoSignedUrl,
    hasPrevPageReference: false,
    designSettings: designSettings,
  });

  // Dispatch Kie createTask for page 1
  const callbackUrl = `${SUPABASE_URL}/functions/v1/a4-callback?batch_id=${batchId}&page=1`;
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
    suggested_pages: gemini.suggested_pages,
    detected_language: gemini.detected_language,
    brand_colors: brandColors,
    notes: gemini.notes_for_renderer ?? "",
  });
});
