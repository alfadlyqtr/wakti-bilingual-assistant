// WAKTI RUNWARE IMAGE
// Single-shot image generation through Runware, used by the Designer's Floor Plan Studio.
//
// Why this exists alongside wakti-grok-image2image:
//   GPT Image 2 is an LLM-based image model, so it actually READS a long structured brief
//   (32k character limit) and holds architectural geometry far better than a diffusion model.
//   For turning a blueprint into a finished plan that must overlay the original exactly, that
//   difference is the whole feature. Grok is kept for Tab 1's photo restyling.
//
// ⛔ DELIVERY IS ASYNC, NOT SYNC. GPT Image 2 takes 2–3 minutes on a dense architectural brief.
// `sync` delivery asks Runware to hold the connection open for that long; it gives up first and
// returns `failedTaskTimeout` — while still generating and BILLING for the image. The caller then
// sees a failure for a picture that exists and was paid for. So: submit the task, get a taskUUID
// back immediately, and let the client poll `getResponse` until the image lands.
//
// This function therefore serves two actions:
//   (default)        submit the render      -> { taskUUID }
//   action: "poll"   check on a submission  -> { status: processing | success | error }
//
// Deliberately self-contained (no ../_shared imports) so it can be deployed through the
// Supabase MCP tool, which does not bundle sibling folders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RUNWARE_ENDPOINT = "https://api.runware.ai/v1";
const DEFAULT_MODEL = "openai:gpt-image@2";
const PROMPT_LIMIT = 32000;
const MAX_REFERENCE_IMAGES = 4;
// Runware accepts any multiple of 16 up to 3840. Capped here because cost and latency scale
// with pixels and a floor plan is legible well below the ceiling.
const DIMENSION_STEP = 16;
const MIN_DIMENSION = 512;
const MAX_DIMENSION = 1536;
// Both calls are short now: submitting returns an acknowledgment, polling returns a status.
const REQUEST_TIMEOUT_MS = 45_000;

/** Snaps a requested dimension onto Runware's step-of-16 grid, inside our own sane bounds. */
function normalizeDimension(raw: unknown, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  const clamped = Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
  return Math.round(clamped / DIMENSION_STEP) * DIMENSION_STEP;
}

/**
 * Runware accepts a UUID, an http URL, a data URI or bare base64 for reference images.
 * Data URIs are what the browser already has, so they pass straight through untouched.
 */
function normalizeReference(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  // Bare base64 — wrap it so Runware knows what it is receiving.
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 64) {
    return `data:image/jpeg;base64,${value.replace(/\s+/g, "")}`;
  }
  return null;
}

/** Pulls the first usable error message out of a Runware failure envelope. */
function extractRunwareError(payload: unknown): string {
  const errors = (payload as { errors?: Array<{ message?: string; code?: string; parameter?: string }> })?.errors;
  if (Array.isArray(errors) && errors.length) {
    const first = errors[0];
    const detail = [first?.code, first?.parameter].filter(Boolean).join(" ");
    return [first?.message || "Runware rejected the request", detail && `(${detail})`]
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

async function logUsage(
  req: Request,
  status: "success" | "error",
  durationMs: number,
  metadata: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const supabase = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    await supabase.rpc("log_ai_usage", {
      p_user_id: userId,
      p_function_name: "wakti-runware-image",
      p_model: String(metadata?.model || DEFAULT_MODEL),
      p_status: status,
      p_error_message: errorMessage || null,
      p_prompt: null,
      p_response: null,
      p_metadata: { ...metadata, provider: "runware" },
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_duration_ms: durationMs,
      p_cost_credits: 0,
    });
  } catch (err) {
    console.error("[runware-image] logging failed:", err instanceof Error ? err.message : String(err));
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** One round trip to Runware. Runware always takes and returns an array of tasks. */
async function callRunware(apiKey: string, tasks: Array<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(RUNWARE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tasks),
      signal: controller.signal,
    });
  } catch (fetchError) {
    const aborted = fetchError instanceof Error && fetchError.name === "AbortError";
    throw new Error(aborted ? "Runware did not respond in time." : String(fetchError));
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractRunwareError(payload) || `Runware error ${response.status}`);
  }
  return payload as Record<string, unknown>;
}

type RunwareEntry = {
  taskUUID?: string;
  status?: string;
  imageURL?: string;
  imageUUID?: string;
  cost?: number;
};

/** The entry for our task, out of however many Runware chose to return. */
function entryFor(payload: Record<string, unknown>, taskUUID: string): RunwareEntry | null {
  const rows = Array.isArray(payload?.data) ? (payload.data as RunwareEntry[]) : [];
  return rows.find((row) => row?.taskUUID === taskUUID) || rows[0] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();

  try {
    // Accept the usual spellings rather than insisting on one. A secret that exists under a
    // slightly different name is otherwise indistinguishable from no secret at all, and costs a
    // full debugging round to find.
    const keyNames = ["RUNWARE_API_KEY", "RUNWARE_KEY", "RUNWARE_TOKEN", "RUNWARE_SECRET"];
    const foundName = keyNames.find((name) => (Deno.env.get(name) || "").trim());
    const apiKey = foundName ? (Deno.env.get(foundName) || "").trim() : "";
    if (!apiKey) {
      return json(
        { success: false, error: `No Runware key found. Set one of: ${keyNames.join(", ")}` },
        500,
      );
    }
    console.log(`[runware-image] using secret ${foundName}`);

    const body = await req.json().catch(() => ({}));

    // ---------------------------------------------------------------- poll an existing task
    if (String(body?.action || "") === "poll") {
      const taskUUID = String(body?.taskUUID || "").trim();
      if (!taskUUID) return json({ success: false, error: "Missing taskUUID" }, 400);

      const payload = await callRunware(apiKey, [{ taskType: "getResponse", taskUUID }]);

      const failure = extractRunwareError(payload);
      const code = (payload as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code || "";
      // A task submitted a moment ago may not be registered yet. Reporting that as a failure
      // would abandon a render that is about to start, so it counts as "still working".
      if (failure && code !== "taskNotFound") {
        await logUsage(req, "error", Date.now() - startTime, { stage: "poll", taskUUID }, failure);
        return json({ success: true, status: "error", error: failure });
      }

      const entry = entryFor(payload, taskUUID);
      const imageUrl = typeof entry?.imageURL === "string" ? entry.imageURL : "";
      if (imageUrl) {
        await logUsage(req, "success", Date.now() - startTime, {
          stage: "poll",
          taskUUID,
          cost: entry?.cost ?? null,
        });
        return json({
          success: true,
          status: "success",
          url: imageUrl,
          imageUUID: entry?.imageUUID || null,
          cost: entry?.cost ?? null,
        });
      }

      return json({ success: true, status: "processing" });
    }

    // ---------------------------------------------------------------- submit a new render
    const prompt = String(body?.prompt || body?.positivePrompt || "").trim().slice(0, PROMPT_LIMIT);
    if (!prompt) return json({ success: false, error: "Missing prompt" }, 400);

    const rawReferences: unknown = body?.referenceImages ?? body?.image_base64s;
    const referenceImages = (Array.isArray(rawReferences) ? rawReferences : [])
      .map(normalizeReference)
      .filter((item): item is string => item !== null)
      .slice(0, MAX_REFERENCE_IMAGES);

    const width = normalizeDimension(body?.width, 1024);
    const height = normalizeDimension(body?.height, 1024);
    const model = String(body?.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const quality = ["low", "medium", "high"].includes(String(body?.quality))
      ? String(body.quality)
      : "high";

    const taskUUID = crypto.randomUUID();
    const task: Record<string, unknown> = {
      taskType: "imageInference",
      taskUUID,
      model,
      positivePrompt: prompt,
      width,
      height,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "JPG",
      outputQuality: 95,
      deliveryMethod: "async",
      includeCost: true,
      providerSettings: { openai: { quality, moderation: "auto" } },
    };
    // Omit `inputs` entirely for text-to-image; an empty referenceImages array is rejected.
    if (referenceImages.length) task.inputs = { referenceImages };

    console.log(`[runware-image] submit ${taskUUID} model=${model} ${width}x${height} refs=${referenceImages.length} promptChars=${prompt.length}`);

    const payload = await callRunware(apiKey, [task]);

    const runwareError = extractRunwareError(payload);
    if (runwareError) throw new Error(runwareError);

    // Async delivery can also come back finished on the spot for a fast model, so an image in
    // the acknowledgment is taken straight away rather than polled for.
    const entry = entryFor(payload, taskUUID);
    const imageUrl = typeof entry?.imageURL === "string" ? entry.imageURL : "";

    await logUsage(req, "success", Date.now() - startTime, {
      stage: "submit",
      model,
      width,
      height,
      referenceCount: referenceImages.length,
      taskUUID,
    });

    return json({
      success: true,
      taskUUID,
      status: imageUrl ? "success" : "processing",
      url: imageUrl || null,
      imageUUID: entry?.imageUUID || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[runware-image] error:", message);
    await logUsage(req, "error", Date.now() - startTime, {}, message);
    return json({ success: false, error: message }, 500);
  }
});
