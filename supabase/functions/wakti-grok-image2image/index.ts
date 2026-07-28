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
const STORAGE_BUCKET = "generated-files";
// Two KIE models are served from this one function because their request shape is identical:
//   { model, input: { prompt, image_urls, aspect_ratio } }
// Only the reference-naming convention differs, which is handled at submit time.
//
//   grok-imagine/image-to-image → diffusion. Binds references with "@image1" tokens. 4 refs.
//                                 Ignores camera instructions; has no real aspect_ratio support.
//   nano-banana-2-lite          → Gemini 3.1 Flash-Lite Image. Reads plain instructions, honours
//                                 aspect_ratio, 10 refs, ~4s per image, same 4-credit price.
//
// ⚠️ nano-banana-2-lite takes `image_urls` — NOT the `image_input` that plain nano-banana-2 uses.
// Sending the wrong key silently produces a text-to-image render with no references at all.
const MODEL_GROK = "grok-imagine/image-to-image";
const MODEL_NANO_LITE = "nano-banana-2-lite";
// Grok stays the default so existing callers that send no model keep their exact behaviour.
const DEFAULT_MODEL = MODEL_GROK;
const REFERENCE_CAPS: Record<string, number> = {
  [MODEL_GROK]: 4,
  [MODEL_NANO_LITE]: 10,
};
const KIE_CREATE_TASK_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
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

function resolveModel(rawValue: unknown): string {
  const value = String(rawValue || "").trim();
  return value === MODEL_NANO_LITE || value === MODEL_GROK ? value : DEFAULT_MODEL;
}

/**
 * Grok cannot bind a reference to a sentence without its own "@imageN" token, so the roles have
 * to be spelled out here. Nano Banana reads the references positionally straight from the
 * caller's own prompt, so nothing is appended for it — the caller knows what each reference is
 * for, and a generic note bolted on here would contradict it.
 */
function buildGrokReferenceNote(count: number): string {
  if (count <= 1) return "Use @image1 as the reference image.";
  const extras = Array.from({ length: count - 1 }, (_, index) => `@image${index + 2}`).join(", ");
  return `Use @image1 as the reference image that defines the camera position, the viewing direction and the framing. ${extras} are additional photographs of the SAME room taken from other angles at the same time. Use them as the truth for the room's shape and proportions, the walls, the windows, the doors and the fixed fittings such as air-conditioning units, radiators and built-in joinery. Do NOT copy their camera angles, do not treat them as different rooms, and never combine the references into a collage or a split image.`;
}

function normalizeAspectRatio(rawValue: unknown): string {
  const value = String(rawValue || "auto").trim();
  if (NANO_BANANA_SUPPORTED_RATIOS.has(value)) {
    return value;
  }
  return "auto";
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripDataUrlPrefix(maybeDataUrl?: string): { base64: string; mimeHint?: string } {
  if (maybeDataUrl?.startsWith("data:")) {
    const [meta, data] = maybeDataUrl.split(",", 2);
    const match = /data:([^;]+);base64/.exec(meta || "");
    return { base64: data || "", mimeHint: match?.[1] };
  }
  return { base64: maybeDataUrl || "" };
}

function detectMimeAndExt(bytes: Uint8Array, mimeHint?: string): { mime: string; ext: string } {
  if (mimeHint && ["image/png", "image/jpeg", "image/webp"].includes(mimeHint)) {
    return { mime: mimeHint, ext: mimeHint === "image/png" ? "png" : mimeHint === "image/jpeg" ? "jpg" : "webp" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[8] === 0x57 && bytes[9] === 0x45) return { mime: "image/webp", ext: "webp" };
  return { mime: "image/jpeg", ext: "jpg" };
}

// STORAGE_BUCKET is PRIVATE, so every reference image MUST be handed to KIE as a signed
// URL. getPublicUrl() on this bucket produces a link that returns an error to KIE, which
// makes the task fail in ~2s with no usable reason. Both callers below share this helper
// so that failure mode cannot come back.
async function uploadReferenceBytes(bytes: Uint8Array, mimeHint: string | undefined, userId: string): Promise<string> {
  const { mime, ext } = detectMimeAndExt(bytes, mimeHint);
  const path = `grok-i2i-input/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Reference upload failed: ${error.message}`);
  const { data: signed, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) throw new Error("Could not create signed URL for reference image");
  return signed.signedUrl;
}

async function uploadReferenceImage(base64: string, mimeHint: string | undefined, userId: string): Promise<string> {
  return uploadReferenceBytes(decodeBase64ToUint8Array(base64), mimeHint, userId);
}

// Extract image URLs from KIE response
// KIE returns: data.state = "success", data.resultJson = JSON string with { resultUrls: ["..."] }
function extractImageUrls(data: any): string[] {
  const urls: string[] = [];
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  // Declared out here so the catch block can report which model actually failed.
  let activeModel = DEFAULT_MODEL;

  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = (body?.user_prompt || body?.prompt || "").toString().trim();
    activeModel = resolveModel(body?.model);
    const referenceCap = REFERENCE_CAPS[activeModel] ?? 4;
    const image_base64_raw: string = body?.image_base64 || "";
    const image_base64s: string[] = Array.isArray(body?.image_base64s)
      ? body.image_base64s.filter((v: unknown) => typeof v === "string" && v.trim().length > 0).slice(0, referenceCap) as string[]
      : [];
    const userId: string = body?.user_id || "";
    const aspectRatio = normalizeAspectRatio(body?.aspect_ratio);
    const callbackUrlFromBody = typeof body?.callBackUrl === "string" ? body.callBackUrl.trim() : "";
    const callbackUrlFromEnv = (Deno.env.get("KIE_NANO_BANANA_CALLBACK_URL") || "").trim();
    const callBackUrl = callbackUrlFromBody || callbackUrlFromEnv || undefined;
    // If taskId is provided, this is a poll request
    const taskId: string = body?.taskId || "";

    const inputImages = image_base64s.length > 0
      ? image_base64s
      : (image_base64_raw ? [image_base64_raw] : []);

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
      console.log(`[grok-i2i] poll taskId=${taskId} HTTP:${resp.status} body:${rawText.slice(0, 1500)}`);

      if (!resp.ok) {
        return new Response(JSON.stringify({ success: false, status: "error", error: `KIE poll HTTP ${resp.status}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const j = JSON.parse(rawText);
      const rawStatus = (j?.data?.state || j?.data?.status || j?.data?.taskStatus || "").toString().toLowerCase();
      console.log(`[grok-i2i] poll state="${rawStatus}" resultJson=${String(j?.data?.resultJson || "").slice(0, 200)}`);

      const isDone = rawStatus === "success" || rawStatus === "completed" || rawStatus === "finished"
        || rawStatus === "succeed" || rawStatus === "done" || rawStatus === "2";
      const isFailed = rawStatus === "failed" || rawStatus === "error" || rawStatus === "fail" || rawStatus === "3";

      if (isFailed) {
        // KIE reports the real cause in failMsg/failCode. Without these the frontend only
        // ever saw "KIE task failed: fail", which hides whether it was a content refusal,
        // an unreachable reference image, or a bad parameter.
        const failMsg = String(j?.data?.failMsg || j?.data?.failureReason || j?.data?.errorMessage || "").trim();
        const failCode = String(j?.data?.failCode ?? j?.data?.errorCode ?? "").trim();
        console.error(`[grok-i2i] task ${taskId} failed code=${failCode} msg=${failMsg}`);
        const detail = [failCode && `KIE ${failCode}`, failMsg].filter(Boolean).join(": ");
        return new Response(JSON.stringify({
          success: false,
          status: "failed",
          failCode,
          failMsg,
          error: detail || `KIE task failed: ${rawStatus}`,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageUrls = extractImageUrls(j?.data);
      if (isDone || imageUrls.length > 0) {
        if (imageUrls.length === 0) {
          return new Response(JSON.stringify({ success: false, status: "failed", error: `Done but no images: ${JSON.stringify(j?.data).slice(0, 200)}` }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const trialPayload = userId
          ? buildTrialSuccessPayload(
              "i2i",
              await checkAndConsumeTrialTokenOnce(supabase, userId, "i2i", 2, taskId),
            )
          : null;
        // Return KIE URLs directly — frontend saves the selected image when user picks one
        await logAIFromRequest(req, {
          functionName: "wakti-grok-image2image",
          provider: activeModel === MODEL_NANO_LITE ? "kie-nano-banana-2-lite" : "kie-grok",
          model: activeModel,
          status: "success",
          durationMs: Date.now() - startTime,
        });
        return new Response(
          JSON.stringify({ success: true, status: "done", urls: imageUrls, count: imageUrls.length, trial: trialPayload }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resultJsonText = typeof j?.data?.resultJson === "string" ? j.data.resultJson : "";
      const stillPending = rawStatus === "pending" || rawStatus === "processing" || rawStatus === "queued" || rawStatus === "running" || rawStatus === "submitted" || rawStatus === "" || rawStatus === "0" || rawStatus === "1";
      if (!stillPending && resultJsonText) {
        const lateUrls = extractImageUrls(j?.data);
        if (lateUrls.length > 0) {
          return new Response(
            JSON.stringify({ success: true, status: "done", urls: lateUrls, count: lateUrls.length, rawStatus }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Still processing
      return new Response(
        JSON.stringify({ success: true, status: "pending", rawStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SUBMIT MODE: upload reference image, submit task, return taskId immediately ──
    if (inputImages.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Missing image" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const promptSafety = prompt
      ? inspectGenerationPrompt(prompt, body?.language === "ar" ? "ar" : "en")
      : null;
    if (promptSafety && !promptSafety.allowed) {
      return new Response(JSON.stringify({ success: false, error: promptSafety.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId) {
      const trial = await checkTrialAccess(supabase, userId, "i2i", 2);
      if (!trial.allowed) {
        return new Response(JSON.stringify({ success: false, ...buildTrialErrorPayload("i2i", trial) }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const referencePublicUrls: string[] = [];
    for (const rawImage of inputImages) {
      let referencePublicUrl = "";
      if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
        // Fetch the URL directly since it's an existing image link (e.g. Picked from saved)
        const res = await fetch(rawImage);
        if (!res.ok) throw new Error(`Failed to fetch saved image: ${res.status}`);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        referencePublicUrl = await uploadReferenceBytes(bytes, undefined, userId || "anon");
      } else {
        const { base64, mimeHint } = stripDataUrlPrefix(rawImage);
        referencePublicUrl = await uploadReferenceImage(base64, mimeHint, userId || "anon");
      }
      referencePublicUrls.push(referencePublicUrl);
    }
    console.log(`[grok-i2i] references uploaded: ${referencePublicUrls.length}`);

    const finalPrompt = promptSafety?.normalizedPrompt ?? prompt;
    console.log(`[grok-i2i] submit prompt="${finalPrompt.slice(0, 100)}"`);
    // Grok only. See buildGrokReferenceNote: an unnamed reference is a reference Grok ignores,
    // whereas Nano Banana takes its reference roles from the caller's own prompt.
    const promptWithRef = activeModel === MODEL_GROK && referencePublicUrls.length > 0
      ? `${finalPrompt}\n\n${buildGrokReferenceNote(referencePublicUrls.length)}`.trim()
      : finalPrompt;
    console.log(`[grok-i2i] model=${activeModel} refs=${referencePublicUrls.length} ratio=${aspectRatio}`);

    const submitResp = await fetch(KIE_CREATE_TASK_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: activeModel,
        ...(callBackUrl ? { callBackUrl } : {}),
        input: {
          prompt: promptWithRef,
          image_urls: referencePublicUrls,
          aspect_ratio: aspectRatio,
        },
      }),
    });
    const submitText = await submitResp.text();
    console.log(`[grok-i2i] submit HTTP:${submitResp.status} body:${submitText.slice(0, 400)}`);

    if (!submitResp.ok) {
      throw new Error(`KIE i2i submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
    }
    const submitJson = JSON.parse(submitText);
    const newTaskId = submitJson?.data?.taskId;
    if (!newTaskId) throw new Error(`No taskId in KIE i2i response: ${submitText.slice(0, 200)}`);

    return new Response(
      JSON.stringify({ success: true, status: "submitted", taskId: newTaskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[grok-i2i] error:`, msg);
    await logAIFromRequest(req, {
      functionName: "wakti-grok-image2image",
      provider: activeModel === MODEL_NANO_LITE ? "kie-nano-banana-2-lite" : "kie-grok",
      model: activeModel,
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
