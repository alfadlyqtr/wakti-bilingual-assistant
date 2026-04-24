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
import { compileMasterPrompt, type A4CreativeSettings } from "../_shared/a4-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const KIE_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_TEXT_MODEL = "gpt-image-2-text-to-image";
const KIE_IMAGE_MODEL = "gpt-image-2-image-to-image";
const KIE_RECORD_INFO_ENDPOINT = "https://api.kie.ai/api/v1/jobs/recordInfo";

function ok(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Kie wraps image-gen callbacks similar to music. Typical shape:
//   { code: 200, data: { taskId, info: { resultUrls: ["https://..."] } } }
// or directly: { taskId, status, resultUrls: [...] } — handle both.
// Nano Banana 2 (image-gen) real shape (per webhook-visual-ads reference):
//   { taskId, state: "success" | "fail",
//     resultJson: "{\"resultUrls\":[\"https://...\"]}", failMsg?: string }
function extractTaskResult(parsed: any): {
  taskId?: string;
  status?: string;
  imageUrl?: string;
  errorMessage?: string;
} {
  const out: any = {};
  const data = parsed?.data ?? parsed;

  out.taskId = data?.taskId || data?.task_id || parsed?.taskId || parsed?.task_id;
  // Accept both "status" (uppercase convention) and "state" (lowercase per Kie image webhook).
  const rawStatus =
    data?.status || parsed?.status || parsed?.state || data?.state || "";
  out.status = String(rawStatus).toUpperCase();

  // Nano Banana 2 image callback returns resultJson as a STRING that itself contains { resultUrls: [...] }.
  // Parse it first so the resultUrls extraction below can find the URL.
  let parsedResultJson: any = null;
  const rawResultJson = data?.resultJson ?? data?.result_json ?? parsed?.resultJson ?? parsed?.result_json;
  if (typeof rawResultJson === "string" && rawResultJson.trim().length > 0) {
    try {
      parsedResultJson = JSON.parse(rawResultJson);
    } catch (e) {
      console.warn("[a4-callback] resultJson not valid JSON:", (e as Error).message);
    }
  } else if (rawResultJson && typeof rawResultJson === "object") {
    parsedResultJson = rawResultJson;
  }

  // Candidate result URL fields (may be strings or objects with .url)
  const resultUrls: any[] =
    parsedResultJson?.resultUrls ||
    parsedResultJson?.result_urls ||
    parsedResultJson?.urls ||
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
    parsed?.failMsg ||
    parsed?.fail_msg ||
    data?.failMsg ||
    data?.fail_msg ||
    data?.errorMessage ||
    data?.error_message ||
    parsed?.errorMessage ||
    parsed?.msg ||
    "";

  return out;
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

async function fetchKieTaskDetail(
  taskId: string,
  apiKey: string,
): Promise<{ taskId?: string; status?: string; imageUrl?: string; errorMessage?: string } | null> {
  try {
    const url = `${KIE_RECORD_INFO_ENDPOINT}?taskId=${encodeURIComponent(taskId)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const raw = await resp.text();
    console.log(`[a4-callback] recordInfo task=${taskId} HTTP:${resp.status} body:${raw.slice(0, 400)}`);
    if (!resp.ok) return null;

    let parsed: any = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return null;
    }

    return extractTaskResult(parsed);
  } catch (e) {
    console.error("[a4-callback] fetchKieTaskDetail error:", (e as Error).message);
    return null;
  }
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
    // Fetch page 1 row to reconstruct form state + creative settings + split content
    const { data: page1, error: p1err } = await svc
      .from("user_a4_documents")
      .select("form_state, total_pages")
      .eq("batch_id", row.batch_id)
      .eq("page_number", 1)
      .maybeSingle();
    if (p1err || !page1?.form_state) {
      console.error(`[a4-callback] page1 form_state missing for batch=${row.batch_id}`);
      return;
    }

    const formStateForPrompt = (page1.form_state as Record<string, unknown>) || {};
    const designSettings = (formStateForPrompt.__design_settings__ as any) ?? null;
    const creativeSettings = (formStateForPrompt.__creative_settings__ as A4CreativeSettings | null) ?? null;
    const splitPages = Array.isArray(formStateForPrompt.__split_pages__)
      ? (formStateForPrompt.__split_pages__ as string[])
      : [];
    const stashedLang = formStateForPrompt.__language_mode__;
    const languageMode: "en" | "ar" | "bilingual" =
      stashedLang === "ar" || stashedLang === "bilingual" || stashedLang === "en"
        ? stashedLang
        : (formStateForPrompt.bilingual === true ? "bilingual" : "en");

    // Page index into split content (0-based). Fall back to full raw_content
    // when the split array is shorter than the requested page number.
    const pageIdx = row.page_number - 1;
    const rawContentForPage =
      splitPages[pageIdx] ??
      splitPages[splitPages.length - 1] ??
      String(formStateForPrompt.raw_content ?? "");

    const prompt = compileMasterPrompt({
      theme,
      purposeId: row.purpose_id ?? null,
      formState: formStateForPrompt,
      rawContent: rawContentForPage,
      pageNumber: row.page_number,
      totalPages: row.total_pages,
      languageMode,
      brandColors: null,
      hasLogoReference: !!logoUrl,
      hasPrevPageReference: true,
      designSettings,
      creativeSettings,
    });

    const imageInputs: string[] = [];
    if (logoUrl) imageInputs.push(logoUrl);
    imageInputs.push(page1ImageUrl);

    const callbackUrl = `${supabaseUrl}/functions/v1/a4-callback?batch_id=${row.batch_id}&page=${row.page_number}`;
    const hasImageInputs = imageInputs.length > 0;

    const payload = {
      model: hasImageInputs ? KIE_IMAGE_MODEL : KIE_TEXT_MODEL,
      callBackUrl: callbackUrl,
      input: {
        prompt,
        ...(hasImageInputs ? { input_urls: imageInputs } : {}),
        aspect_ratio: mapKieAspectRatio(row.aspect_ratio || theme.aspect_ratio),
        ...(!hasImageInputs ? { resolution: "1K" } : {}),
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

    const taskIdForLookup = result.taskId || row.kie_task_id || undefined;
    let finalResult: any = result;
    if (!finalResult.imageUrl && taskIdForLookup && KIE_API_KEY) {
      const fetched = await fetchKieTaskDetail(String(taskIdForLookup), KIE_API_KEY);
      if (fetched) {
        finalResult = {
          taskId: fetched.taskId || finalResult.taskId,
          status: fetched.status || finalResult.status,
          imageUrl: fetched.imageUrl || finalResult.imageUrl,
          errorMessage: fetched.errorMessage || finalResult.errorMessage,
        };
      } else {
        console.error(`[a4-callback] failed to fetch task detail for task=${taskIdForLookup}`);
      }
    }

    const isSuccess =
      finalResult.status === "SUCCESS" ||
      finalResult.status === "COMPLETE" ||
      finalResult.status === "DONE" ||
      !!finalResult.imageUrl;
    const isFailed =
      finalResult.status === "FAILED" ||
      finalResult.status === "ERROR" ||
      finalResult.status === "FAIL";

    if (isFailed) {
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: finalResult.errorMessage || "Kie reported failure" })
        .eq("id", row.id);
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: "Upstream page failed" })
        .eq("batch_id", row.batch_id)
        .eq("status", "queued");
      return ok();
    }

    const isTerminalWithoutImage =
      (finalResult.status === "SUCCESS" ||
        finalResult.status === "COMPLETE" ||
        finalResult.status === "DONE") &&
      !finalResult.imageUrl;

    if (isTerminalWithoutImage) {
      await svc
        .from("user_a4_documents")
        .update({ status: "failed", error_message: "Kie completed the task but returned no image URL" })
        .eq("id", row.id);
      return ok();
    }

    if (!isSuccess || !finalResult.imageUrl) {
      // Intermediate/unknown stage — just ack
      console.log(`[a4-callback] intermediate stage status=${finalResult.status} task=${taskIdForLookup} — ack`);
      return ok();
    }

    // Success: download + store
    const storagePath = `${row.user_id}/${row.batch_id}/page_${row.page_number}.jpg`;
    const signedUrl = await downloadAndStore(svc, finalResult.imageUrl, storagePath, "image/jpeg");

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
        kie_raw_url: finalResult.imageUrl,
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
