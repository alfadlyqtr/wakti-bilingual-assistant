// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialTokenOnce, checkTrialAccess } from "../_shared/trial-tracker.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { inspectGenerationPrompt } from "../_shared/promptSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KIE_API_KEY = (
  Deno.env.get("KIE_AI_API_KEY")
  || Deno.env.get("KIE_API_KEY")
  || Deno.env.get("NANO_BANANA_API_KEY")
  || Deno.env.get("KIE_BEARER_TOKEN")
  || ""
).trim();
// Quick tier = Nano Banana 2 Lite (fast: ~11-16s). Grok 2.0 moved to its own upcoming mode.
// Set KIE_GROK_T2I_MODEL in Supabase secrets to override without redeploying.
const MODEL = (Deno.env.get("KIE_GROK_T2I_MODEL") || "nano-banana-2-lite").trim();
const MODEL_FALLBACK_1X = "grok-imagine/text-to-image";
// Kie's 2.0 docs point to /api/v1/client/tasks but that endpoint returns 404 (docs ahead
// of their rollout). jobs/createTask is Kie's unified entry point for ALL Market models.
const KIE_CREATE_TASK_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
// recordInfo is Kie's unified query endpoint — works for all Market models, 1.x and 2.0.
const KIE_RECORD_INFO_ENDPOINT = "https://api.kie.ai/api/v1/jobs/recordInfo";
const NANO_BANANA_SUPPORTED_RATIOS = new Set([
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
  "auto",
]);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GROK_2_SUPPORTED_RATIOS = new Set(["1:1", "2:3", "3:2", "9:16", "16:9"]);
// Pro Image Studio requests Grok 2.0 explicitly via body.model — only this model may override.
const ALLOWED_MODEL_OVERRIDES = new Set(["grok-imagine-image-2-0/text-to-image"]);

function normalizeAspectRatio(rawValue: unknown, model: string): string {
  const value = String(rawValue || "auto").trim();
  // 2.0 has no "auto" and a tighter ratio list — fall back to 1:1
  if (model.startsWith("grok-imagine-image-2-0/")) {
    return GROK_2_SUPPORTED_RATIOS.has(value) ? value : "1:1";
  }
  if (NANO_BANANA_SUPPORTED_RATIOS.has(value)) {
    return value;
  }
  return "auto";
}

// Extract image URLs from KIE response
// KIE returns: data.state = "success", data.resultJson = JSON string with { resultUrls: ["..."] }
function extractImageUrls(data: any): string[] {
  const urls: string[] = [];
  // Primary: parse resultJson string
  if (typeof data?.resultJson === "string" && data.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson);
      if (Array.isArray(parsed?.resultUrls)) {
        for (const u of parsed.resultUrls) {
          if (typeof u === "string" && u.startsWith("http")) urls.push(u);
        }
      }
    } catch { /* ignore */ }
  }
  if (urls.length > 0) return urls;
  // Fallback: scan all string fields for http URLs
  const seen = new Set<string>();
  const scan = (obj: any, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 8) return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.startsWith("http") && !seen.has(v)) {
        const keyLooksImagey = /url|image|img|src|uri|link|photo|pic/i.test(k);
        const hasImageExt = /\.(png|jpg|jpeg|webp)/i.test(v);
        if (keyLooksImagey || hasImageExt) { seen.add(v); urls.push(v); }
      } else if (v && typeof v === "object") scan(v, depth + 1);
    }
  };
  scan(data);
  return urls;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = (body?.prompt || "").toString().trim();
    const userId: string = body?.user_id || "";
    const requestedModel = typeof body?.model === "string" ? body.model.trim() : "";
    const requestModel = ALLOWED_MODEL_OVERRIDES.has(requestedModel) ? requestedModel : MODEL;
    const aspectRatio = normalizeAspectRatio(body?.aspect_ratio, requestModel);
    const callbackUrlFromBody = typeof body?.callBackUrl === "string" ? body.callBackUrl.trim() : "";
    const callbackUrlFromEnv = (Deno.env.get("KIE_NANO_BANANA_CALLBACK_URL") || "").trim();
    const callBackUrl = callbackUrlFromBody || callbackUrlFromEnv || undefined;
    // If taskId is provided, this is a poll request — check status and return images if ready
    const taskId: string = body?.taskId || "";

    if (!KIE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "KIE_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POLL MODE: frontend sends taskId to check status ──
    if (taskId) {
      const resp = await fetch(`${KIE_RECORD_INFO_ENDPOINT}?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const rawText = await resp.text();
      console.log(`[grok-t2i] poll taskId=${taskId} HTTP:${resp.status} body:${rawText.slice(0, 600)}`);

      if (!resp.ok) {
        return new Response(JSON.stringify({ success: false, status: "error", error: `KIE poll HTTP ${resp.status}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const j = JSON.parse(rawText);
      // KIE uses data.state for status (not data.status)
      const rawStatus = (j?.data?.state || j?.data?.status || j?.data?.taskStatus || "").toString().toLowerCase();
      console.log(`[grok-t2i] poll state="${rawStatus}" resultJson=${String(j?.data?.resultJson || "").slice(0, 200)}`);

      const isDone = rawStatus === "success" || rawStatus === "completed" || rawStatus === "finished"
        || rawStatus === "succeed" || rawStatus === "done" || rawStatus === "2";
      const isFailed = rawStatus === "failed" || rawStatus === "error" || rawStatus === "fail" || rawStatus === "3";

      if (isFailed) {
        return new Response(JSON.stringify({ success: false, status: "failed", error: `KIE task failed: ${rawStatus}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to extract images whether done or unknown status
      const imageUrls = extractImageUrls(j?.data);
      if (isDone || imageUrls.length > 0) {
        if (imageUrls.length === 0) {
          return new Response(JSON.stringify({ success: false, status: "failed", error: `Done but no images: ${JSON.stringify(j?.data).slice(0, 200)}` }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const trialPayload = userId
          ? buildTrialSuccessPayload(
              "t2i",
              await checkAndConsumeTrialTokenOnce(supabase, userId, "t2i", 2, taskId),
            )
          : null;
        // Return KIE URLs directly — frontend saves the selected image when user picks one
        await logAIFromRequest(req, {
          functionName: "wakti-grok-text2image",
          provider: "kie-grok",
          model: MODEL,
          status: "success",
          durationMs: Date.now() - startTime,
          metadata: { taskId, imageCount: imageUrls.length },
        });
        return new Response(
          JSON.stringify({ success: true, status: "done", urls: imageUrls, count: imageUrls.length, trial: trialPayload }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      return new Response(
        JSON.stringify({ success: true, status: "pending", rawStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SUBMIT MODE: translate prompt and submit task, return taskId immediately ──
    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptSafety = inspectGenerationPrompt(prompt, body?.language === "ar" ? "ar" : "en");
    if (!promptSafety.allowed) {
      return new Response(JSON.stringify({ success: false, error: promptSafety.message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId) {
      const trial = await checkTrialAccess(supabase, userId, "t2i", 2);
      if (!trial.allowed) {
        return new Response(JSON.stringify({ success: false, ...buildTrialErrorPayload("t2i", trial) }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const finalPrompt = promptSafety.normalizedPrompt;
    console.log(`[grok-t2i] submit prompt="${finalPrompt.slice(0, 100)}" aspect=${aspectRatio}`);

    const submitToKie = async (model: string) => {
      const resp = await fetch(KIE_CREATE_TASK_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          ...(callBackUrl ? { callBackUrl } : {}),
          input: {
            prompt: finalPrompt,
            aspect_ratio: aspectRatio,
          },
        }),
      });
      return { resp, text: await resp.text() };
    };

    let activeModel = requestModel;
    let { resp: submitResp, text: submitText } = await submitToKie(activeModel);
    console.log(`[grok-t2i] submit model=${activeModel} HTTP:${submitResp.status} body:${submitText.slice(0, 400)}`);

    // Safety net: if Kie rejects the 2.0 model, retry once with the proven 1.x model
    // so Quick mode never breaks for users while Kie finishes their 2.0 rollout.
    if (!submitResp.ok && activeModel !== MODEL_FALLBACK_1X) {
      console.warn(`[grok-t2i] 2.0 submit failed (HTTP ${submitResp.status}), falling back to ${MODEL_FALLBACK_1X}`);
      activeModel = MODEL_FALLBACK_1X;
      ({ resp: submitResp, text: submitText } = await submitToKie(activeModel));
      console.log(`[grok-t2i] fallback submit HTTP:${submitResp.status} body:${submitText.slice(0, 400)}`);
    }

    if (!submitResp.ok) {
      throw new Error(`KIE submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
    }
    const submitJson = JSON.parse(submitText);
    const newTaskId = submitJson?.data?.taskId;
    if (!newTaskId) throw new Error(`No taskId in KIE response: ${submitText.slice(0, 200)}`);

    return new Response(
      JSON.stringify({ success: true, status: "submitted", taskId: newTaskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[grok-t2i] error:`, msg);
    await logAIFromRequest(req, {
      functionName: "wakti-grok-text2image",
      provider: "kie-grok",
      model: MODEL,
      status: "error",
      errorMessage: msg,
      durationMs: Date.now() - startTime,
    });
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
