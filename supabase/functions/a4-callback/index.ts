// deno-lint-ignore-file no-explicit-any
// A4 Document Builder — Kie Webhook Callback
// -----------------------------------------------------------------------------
// Receives the Kie.ai POST webhook when a Nano Banana 2 task finishes.
// 1. Always 200 OK fast (Kie retries on non-200).
// 2. Find the matching row by kie_task_id OR by query params (batch_id + page).
// 3. Download final image → store in a4-documents bucket → update row to completed.
// 4. If this was page N of a multi-page doc and more pages remain, compile +
//    dispatch the next page using page 1 image as the style-anchor reference.
// -----------------------------------------------------------------------------

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { findTheme } from "../_shared/a4-themes.ts";
import { compileMasterPrompt, type GeminiPage } from "../_shared/a4-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const KIE_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_MODEL = "nano-banana-2";

function ok(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Kie wraps image-gen callbacks similar to music. Typical shape:
//   { code: 200, data: { taskId, info: { resultUrls: ["https://..."] } } }
// or directly: { taskId, status, resultUrls: [...] } — handle both.
function extractTaskResult(parsed: any): {
  taskId?: string;
  status?: string;
  imageUrl?: string;
  errorMessage?: string;
} {
  const out: any = {};
  const data = parsed?.data ?? parsed;

  out.taskId = data?.taskId || data?.task_id || parsed?.taskId || parsed?.task_id;
  out.status = String(
    data?.status || parsed?.status || parsed?.state || data?.state || "",
  ).toUpperCase();

  // Candidate result URL fields (may be strings or objects with .url)
  const resultUrls: any[] =
    data?.resultUrls ||
    data?.result_urls ||
    data?.info?.resultUrls ||
    data?.info?.result_urls ||
    parsed?.resultUrls ||
    parsed?.result_urls ||
    data?.output?.resultUrls ||
    data?.output?.images ||
    [];

  if (Array.isArray(resultUrls) && resultUrls.length > 0) {
    const first = resultUrls[0];
    out.imageUrl = typeof first === "string" ? first : first?.url;
  }

  // Some providers return a single url field
  if (!out.imageUrl) {
    out.imageUrl = data?.imageUrl || data?.image_url || data?.url || parsed?.url;
  }

  out.errorMessage =
    data?.errorMessage ||
    data?.error_message ||
    parsed?.errorMessage ||
    parsed?.msg ||
    "";

  return out;
}

async function downloadAndStore(
  svc: any,
  url: string,
  storagePath: string,
  contentType: string,
): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[a4-callback] failed to fetch ${url}: ${resp.status}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const { error: upErr } = await svc.storage
      .from("a4-documents")
      .upload(storagePath, bytes, { contentType, upsert: true });
    if (upErr) {
      console.error(`[a4-callback] upload error for ${storagePath}:`, upErr);
      return null;
    }
    const { data: signed, error: signErr } = await svc.storage
      .from("a4-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
    if (signErr || !signed) {
      console.error("[a4-callback] signed URL error:", signErr);
      return null;
    }
    return signed.signedUrl;
  } catch (e) {
    console.error("[a4-callback] downloadAndStore error:", (e as Error).message);
    return null;
  }
}

// Dispatch next page's Kie task using page 1 image as style anchor reference.
async function dispatchNextPage(
  svc: any,
  row: any, // next page row from DB (status=queued)
  page1ImageUrl: string,
  logoUrl: string | null,
  apiKey: string,
  supabaseUrl: string,
): Promise<void> {
  try {
    const theme = findTheme(row.theme_id);
    if (!theme) {
      console.error(`[a4-callback] theme not found: ${row.theme_id}`);
      return;
    }
    // Fetch page 1 row to get the full gemini_output (pages array)
    const { data: page1, error: p1err } = await svc
      .from("user_a4_documents")
      .select("gemini_output, form_state, total_pages")
      .eq("batch_id", row.batch_id)
      .eq("page_number", 1)
      .maybeSingle();
    if (p1err || !page1?.gemini_output) {
      console.error(`[a4-callback] page1 gemini_output missing for batch=${row.batch_id}`);
      return;
    }
    const geminiPages: GeminiPage[] = (page1.gemini_output as any).pages || [];
    const languageMode: "en" | "ar" | "bilingual" =
      ((page1.form_state as any)?.bilingual === true ? "bilingual" : "en") as any;

    const prompt = compileMasterPrompt({
      theme,
      purposeId: row.purpose_id ?? null,
      formState: (page1.form_state as any) || {},
      geminiPages,
      pageNumber: row.page_number,
      totalPages: row.total_pages,
      languageMode,
      brandColors: null,
      hasLogoReference: !!logoUrl,
      hasPrevPageReference: true,
    });

    const imageInputs: string[] = [];
    if (logoUrl) imageInputs.push(logoUrl);
    imageInputs.push(page1ImageUrl);

    const callbackUrl = `${supabaseUrl}/functions/v1/a4-callback?batch_id=${row.batch_id}&page=${row.page_number}`;

    const payload = {
      model: KIE_MODEL,
      callBackUrl: callbackUrl,
      input: {
        prompt,
        image_input: imageInputs,
        aspect_ratio: row.aspect_ratio || theme.aspect_ratio,
        resolution: "1K",
        output_format: "jpg",
      },
    };

    const resp = await fetch(KIE_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await resp.text();
    console.log(
      `[a4-callback] dispatch page ${row.page_number} HTTP:${resp.status} body:${raw.slice(0, 300)}`,
    );
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const taskId = parsed?.data?.taskId;
    if (parsed?.code === 200 && taskId) {
      await svc
        .from("user_a4_documents")
        .update({
          kie_task_id: String(taskId),
          compiled_prompt: prompt,
          reference_image_url: page1ImageUrl,
          status: "generating",
        })
        .eq("id", row.id);
    } else {
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: parsed?.msg || `Kie error (page ${row.page_number})` })
        .eq("id", row.id);
    }
  } catch (e) {
    console.error("[a4-callback] dispatchNextPage error:", (e as Error).message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[a4-callback] missing env");
    return ok();
  }

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const qBatchId = url.searchParams.get("batch_id");
  const qPage = Number(url.searchParams.get("page") || "0");

  try {
    const rawBody = await req.text();
    console.log(`[a4-callback] batch=${qBatchId} page=${qPage} RAW:${rawBody.slice(0, 500)}`);

    let parsed: any = {};
    try {
      parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.warn("[a4-callback] body not JSON");
    }

    const result = extractTaskResult(parsed);
    const isSuccess =
      result.status === "SUCCESS" ||
      result.status === "COMPLETE" ||
      result.status === "DONE" ||
      !!result.imageUrl;
    const isFailed =
      result.status === "FAILED" ||
      result.status === "ERROR" ||
      result.status === "FAIL";

    // Find target row: prefer query params (batch_id + page) for reliability, fall back to task_id
    let rowQuery = svc.from("user_a4_documents").select("*").limit(1);
    if (qBatchId && qPage) {
      rowQuery = rowQuery.eq("batch_id", qBatchId).eq("page_number", qPage);
    } else if (result.taskId) {
      rowQuery = rowQuery.eq("kie_task_id", result.taskId);
    } else {
      console.warn("[a4-callback] no identifiers in callback — ack and exit");
      return ok();
    }
    const { data: rows, error: fetchErr } = await rowQuery;
    if (fetchErr || !rows || rows.length === 0) {
      console.warn(`[a4-callback] no row found (batch=${qBatchId} page=${qPage} task=${result.taskId})`);
      return ok();
    }
    const row = rows[0];

    if (isFailed) {
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: result.errorMessage || "Kie reported failure" })
        .eq("id", row.id);
      // Also fail any queued siblings
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: "Upstream page failed" })
        .eq("batch_id", row.batch_id)
        .eq("status", "queued");
      return ok();
    }

    if (!isSuccess || !result.imageUrl) {
      // Intermediate/unknown stage — just ack
      console.log(`[a4-callback] intermediate stage status=${result.status} — ack`);
      return ok();
    }

    // Success: download + store
    const storagePath = `${row.user_id}/${row.batch_id}/page_${row.page_number}.jpg`;
    const signedUrl = await downloadAndStore(svc, result.imageUrl, storagePath, "image/jpeg");

    if (!signedUrl) {
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: "Failed to persist Kie image" })
        .eq("id", row.id);
      return ok();
    }

    await svc
      .from("user_a4_documents")
      .update({
        status: "completed",
        image_url: signedUrl,
        kie_raw_url: result.imageUrl,
      })
      .eq("id", row.id);

    // If this was page 1 of a multi-page doc, dispatch next queued page using this image as reference
    if (row.page_number === 1 && row.total_pages > 1) {
      const { data: nextRows } = await svc
        .from("user_a4_documents")
        .select("*")
        .eq("batch_id", row.batch_id)
        .eq("status", "queued")
        .order("page_number", { ascending: true });

      // Dispatch page 2 immediately; pages 3+ are dispatched in parallel too,
      // all anchored to page 1's image (for maximum style consistency).
      if (Array.isArray(nextRows)) {
        const logoUrl = row.reference_image_url as string | null; // page1 stored logo ref here pre-generation
        // After success we overwrote reference_image_url with the page1 image URL? No — we didn't.
        // We kept logo on page 1. So pass logo through from page1 row's reference_image_url.
        for (const nextRow of nextRows) {
          // Fire-and-forget — Kie will callback each separately
          dispatchNextPage(svc, nextRow, signedUrl, logoUrl, KIE_API_KEY, SUPABASE_URL).catch((e) =>
            console.error("[a4-callback] next dispatch error:", (e as Error).message),
          );
        }
      }
    }

    return ok();
  } catch (e) {
    console.error("[a4-callback] unhandled:", (e as Error).message);
    // Always ack to avoid Kie retry storms
    return ok({ ok: true, warning: "logged" });
  }
});
