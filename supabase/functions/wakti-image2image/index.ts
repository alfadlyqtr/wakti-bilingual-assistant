import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialToken, checkTrialAccess } from "../_shared/trial-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Strip a data URL prefix if present, returning the raw base64 and an optional mime hint
function stripDataUrlPrefix(maybeDataUrl?: string): { base64: string; mimeHint?: string } {
  if (maybeDataUrl && maybeDataUrl.startsWith("data:")) {
    const [meta, data] = maybeDataUrl.split(",", 2);
    const match = /data:([^;]+);base64/.exec(meta || "");
    const mime = match?.[1];
    return { base64: data || "", mimeHint: mime };
  }
  return { base64: maybeDataUrl || "" };
}

// Try to detect mime and file extension from bytes (fallback to hint)
function detectMimeAndExt(bytes: Uint8Array, mimeHint?: string): { mime: string; ext: string } {
  if (mimeHint && (mimeHint === "image/png" || mimeHint === "image/jpeg" || mimeHint === "image/webp")) {
    return {
      mime: mimeHint,
      ext: mimeHint === "image/png" ? "png" : mimeHint === "image/jpeg" ? "jpg" : "webp",
    };
  }
  // PNG signature
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  // JPEG signature
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  // WEBP signature (RIFF....WEBP)
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  return { mime: "image/png", ext: "png" };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "generated-files";
const SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const KIE_API_KEY = Deno.env.get("KIE_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY")!;
const MODEL_FAST = Deno.env.get("RUNWARE_FAST_MODEL") || "openai:gpt-image@2";
const MODEL_BEST = "nano-banana-2";

function getDimensionsForModel(model: string): { width?: number; height?: number } {
  if (model === "openai:gpt-image@2") return { width: 1024, height: 1536 };
  return {};
}

function isRetryableRunwareErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("\"status\":502")
    || normalized.includes("\"status\":503")
    || normalized.includes("\"status\":504")
    || normalized.includes("timed out")
    || normalized.includes("abort");
}

function extractImageUrls(data: unknown): string[] {
  const urls: string[] = [];
  if (typeof (data as { resultJson?: unknown } | null)?.resultJson === "string" && (data as { resultJson: string }).resultJson) {
    try {
      const parsed = JSON.parse((data as { resultJson: string }).resultJson);
      if (Array.isArray(parsed?.resultUrls)) {
        for (const u of parsed.resultUrls) {
          if (typeof u === "string" && u.startsWith("http")) urls.push(u);
        }
      }
    } catch {
      // ignore malformed resultJson and continue scanning
    }
  }
  if (urls.length > 0) return urls;
  const seen = new Set<string>();
  const scan = (obj: unknown, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 8) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string" && v.startsWith("http") && !seen.has(v)) {
        const keyLooksImagey = /url|image|img|src|uri|link|photo|pic/i.test(k);
        const hasImageExt = /\.(png|jpg|jpeg|webp)/i.test(v);
        if (keyLooksImagey || hasImageExt) {
          seen.add(v);
          urls.push(v);
        }
      } else if (v && typeof v === "object") {
        scan(v, depth + 1);
      }
    }
  };
  scan(data);
  return urls;
}

async function pollKieTaskForImage(taskId: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const resp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    const rawText = await resp.text();
    if (!resp.ok) {
      throw new Error(`KIE poll failed ${resp.status}: ${rawText.slice(0, 200)}`);
    }
    const json = JSON.parse(rawText);
    const rawStatus = (json?.data?.state || json?.data?.status || json?.data?.taskStatus || "").toString().toLowerCase();
    const imageUrls = extractImageUrls(json?.data);
    const isDone = rawStatus === "success" || rawStatus === "completed" || rawStatus === "finished"
      || rawStatus === "succeed" || rawStatus === "done" || rawStatus === "2";
    const isFailed = rawStatus === "failed" || rawStatus === "error" || rawStatus === "fail" || rawStatus === "3";
    if (isFailed) {
      throw new Error(`KIE task failed: ${rawStatus}`);
    }
    if ((isDone || imageUrls.length > 0) && imageUrls[0]) {
      return imageUrls[0];
    }
  }
  throw new Error("KIE generation timed out");
}

async function generateBestWithKie(finalPrompt: string, referenceUrls: string[]): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const submitResp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_BEST,
      input: {
        prompt: finalPrompt,
        image_input: referenceUrls,
        resolution: "1K",
        output_format: "jpg",
      },
    }),
  });
  const submitText = await submitResp.text();
  if (!submitResp.ok) {
    throw new Error(`KIE i2i submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
  }
  const submitJson = JSON.parse(submitText);
  const taskId = submitJson?.data?.taskId;
  if (!taskId) throw new Error(`No taskId in KIE i2i response: ${submitText.slice(0, 200)}`);
  return await pollKieTaskForImage(taskId);
}

function genUUID(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function _findTaskUUID(obj: unknown): string | null {
  const isUUID = (v: unknown): v is string => typeof v === 'string' && /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(v);
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  for (const key of ["taskUUID", "taskUuid", "uuid", "id"]) {
    const val = rec[key];
    if (isUUID(val)) return val;
  }
  for (const k in rec) {
    const v = rec[k];
    if (v && typeof v === 'object') {
      const found = _findTaskUUID(v);
      if (found) return found;
    }
  }
  return null;
}

function pickFirstResultNode(container: unknown): unknown | null {
  if (!container || typeof container !== 'object') return null;
  const rec = container as Record<string, unknown>;
  const keys = ["results", "data", "output", "outputs", "media"];
  for (const k of keys) {
    const maybeArr = rec[k] as unknown;
    if (Array.isArray(maybeArr) && maybeArr.length > 0) return maybeArr[0];
  }
  if (Array.isArray(container as unknown[])) {
    const arrCont = container as unknown[];
    if (arrCont.length > 0) return pickFirstResultNode(arrCont[0]);
  }
  return null;
}

async function safeJson(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text || text.trim().length === 0) return null;
  try { return JSON.parse(text) as unknown; } catch { return { __raw: text } as { __raw: string }; }
}

async function uploadAndSignReferenceImage(params: {
  base64: string;
  mime: string;
  ext: string;
  userId: string;
}): Promise<string> {
  const { base64, mime, ext, userId } = params;
  const bytes = decodeBase64ToUint8Array(base64);
  const path = `i2i-input/${userId}/${genUUID()}.${ext}`;

  const up = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });

  if (up.error) {
    throw new Error(JSON.stringify({ stage: "storage_upload", bucket: STORAGE_BUCKET, path, error: up.error }));
  }

  const signed = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(JSON.stringify({ stage: "storage_signed_url", bucket: STORAGE_BUCKET, path, error: signed.error }));
  }

  return signed.data.signedUrl;
}

async function callRunwareI2I(finalPrompt: string, referenceImages: string[], model: string): Promise<unknown> {
  const { width, height } = getDimensionsForModel(model);
  const isOpenAIImageModel = model.startsWith("openai:gpt-image");
  const inferenceTask: Record<string, unknown> = {
    taskType: "imageInference",
    taskUUID: genUUID(),
    model,
    positivePrompt: finalPrompt,
    numberResults: 1,
    outputType: ["dataURI", "URL"],
    includeCost: true,
    outputQuality: 85,
  };

  if (width && height) {
    inferenceTask.width = width;
    inferenceTask.height = height;
  }

  if (isOpenAIImageModel) {
    inferenceTask.providerSettings = {
      openai: {
        quality: "low",
      },
    };
    inferenceTask.inputs = {
      referenceImages,
    };
  } else {
    // For google:4@3 in i2i mode, omit width/height so the model automatically matches the reference image aspect ratio.
    inferenceTask.referenceImages = referenceImages;
  }

  const payload = [
    { taskType: "authentication", apiKey: RUNWARE_API_KEY },
    inferenceTask
  ];

  const r = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await safeJson(r);
  if (!r.ok || !j) throw new Error(JSON.stringify({ stage: "create", status: r.status, details: j ?? { error: "empty" } }));
  return j;
}

async function callRunwareI2IWithRetry(finalPrompt: string, referenceImages: string[], model: string): Promise<unknown> {
  try {
    return await callRunwareI2I(finalPrompt, referenceImages, model);
  } catch (err) {
    const message = String((err as Error)?.message || err || "");
    if (!isRetryableRunwareErrorMessage(message)) throw err;
    return await callRunwareI2I(finalPrompt, referenceImages, model);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const quality = body?.quality === "best_fast" ? "best_fast" : "fast";
    const selectedModel = quality === "best_fast" ? MODEL_BEST : MODEL_FAST;
    const image_base64_raw = (body?.image_base64 || body?.image || "").toString();
    const image_base64_raw_2 = (body?.image_base64_2 || "").toString();
    const image_base64s = Array.isArray(body?.image_base64s) ? body.image_base64s : [];

    const user_prompt = body?.user_prompt as string | undefined;
    const user_id = body?.user_id as string | undefined;
    let trialPayload = null;

    const inputImages = image_base64s.length > 0
      ? image_base64s
      : [image_base64_raw, image_base64_raw_2].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    if (quality !== "best_fast" && !RUNWARE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing RUNWARE_API_KEY", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (inputImages.length === 0 || !user_prompt || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing params", code: "BAD_REQUEST_MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Trial Token Check: i2i ──
    const trial = await checkTrialAccess(supabase, user_id, 'i2i', 2);
    if (!trial.allowed) {
      return new Response(
        JSON.stringify(buildTrialErrorPayload('i2i', trial)),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ── End Trial Token Check ──

    const referenceUrls: string[] = [];
    for (const rawImage of inputImages) {
      if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
        const res = await fetch(rawImage);
        if (!res.ok) throw new Error(`Failed to fetch saved image: ${res.status}`);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const { mime, ext } = detectMimeAndExt(bytes);
        
        // Convert to base64 so we can use the existing uploadAndSignReferenceImage
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        const referenceUrl = await uploadAndSignReferenceImage({ base64, mime, ext, userId: user_id || "anon" });
        referenceUrls.push(referenceUrl);
      } else {
        const { base64, mimeHint } = stripDataUrlPrefix(rawImage);
        const inputBytes = decodeBase64ToUint8Array(base64);
        const { mime, ext } = detectMimeAndExt(inputBytes, mimeHint);
        const referenceUrl = await uploadAndSignReferenceImage({ base64, mime, ext, userId: user_id || "anon" });
        referenceUrls.push(referenceUrl);
      }
    }

    const finalPrompt = user_prompt;
    if (quality === "best_fast") {
      const stableUrl = await generateBestWithKie(finalPrompt, referenceUrls);

      await logAIFromRequest(req, {
        functionName: "wakti-image2image",
        provider: quality === "best_fast" ? "kie-nano-banana-2" : "runware",
        model: selectedModel,
        inputText: user_prompt,
        status: "success"
      });

      const consumeTrial = await checkAndConsumeTrialToken(supabase, user_id, 'i2i', 2);
      if (consumeTrial.allowed) {
        trialPayload = buildTrialSuccessPayload('i2i', consumeTrial);
      } else {
        console.warn('[wakti-image2image] Trial consume skipped after success:', consumeTrial.reason);
      }

      return new Response(
        JSON.stringify({ success: true, url: stableUrl, model: selectedModel, quality, trial: trialPayload }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rw = await callRunwareI2IWithRetry(finalPrompt, referenceUrls, selectedModel);
    const node = (pickFirstResultNode(rw) || rw) as Record<string, unknown>;

    // Extract the Runware output — prefer dataURI (stable), fallback to URL
    const outputDataURI = (node?.imageDataURI || node?.dataURI || node?.dataUrl) as string | undefined;
    const outputImageUrl = (node?.imageURL || node?.URL || node?.url) as string | undefined;
    
    console.log("🎨 Runware result:", { keys: Object.keys(node || {}), hasDataURI: !!outputDataURI, outputImageUrl: outputImageUrl?.slice(0, 80) });

    if (outputDataURI || outputImageUrl) {
      // Download/decode the image and re-upload to Supabase Storage for a stable URL
      let stableUrl: string;
      try {
        let imageBytes: Uint8Array;
        let imageMime = "image/png";

        if (outputDataURI) {
          const { base64: outB64, mimeHint } = stripDataUrlPrefix(outputDataURI);
          imageBytes = decodeBase64ToUint8Array(outB64);
          if (mimeHint) imageMime = mimeHint;
        } else {
          // Fetch from Runware CDN URL
          const fetchResp = await fetch(outputImageUrl!);
          if (!fetchResp.ok) throw new Error(`Failed to fetch output image: ${fetchResp.status}`);
          const arrayBuf = await fetchResp.arrayBuffer();
          imageBytes = new Uint8Array(arrayBuf);
          const ct = fetchResp.headers.get("content-type");
          if (ct && ct.startsWith("image/")) imageMime = ct.split(";")[0].trim();
        }

        const { mime, ext } = detectMimeAndExt(imageBytes, imageMime);
        const outputPath = `i2i-output/${user_id}/${genUUID()}.${ext}`;
        const upOut = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(outputPath, imageBytes, { contentType: mime, upsert: true });
        if (upOut.error) throw new Error(`Output upload failed: ${upOut.error.message}`);

        const signedOut = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(outputPath, 60 * 60 * 24); // 24h
        if (signedOut.error || !signedOut.data?.signedUrl) throw new Error("Output signed URL failed");
        stableUrl = signedOut.data.signedUrl;
      } catch (uploadErr: unknown) {
        // Fallback to direct URL if re-upload fails
        console.error("🎨 Output re-upload failed, falling back to direct URL:", (uploadErr as Error)?.message);
        stableUrl = outputImageUrl || outputDataURI!;
      }

      // Log successful AI usage
      await logAIFromRequest(req, {
        functionName: "wakti-image2image",
        provider: "runware",
        model: selectedModel,
        inputText: user_prompt,
        status: "success"
      });

      const consumeTrial = await checkAndConsumeTrialToken(supabase, user_id, 'i2i', 2);
      if (consumeTrial.allowed) {
        trialPayload = buildTrialSuccessPayload('i2i', consumeTrial);
      } else {
        console.warn('[wakti-image2image] Trial consume skipped after success:', consumeTrial.reason);
      }

      return new Response(
        JSON.stringify({ success: true, url: stableUrl, model: selectedModel, quality, trial: trialPayload }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "RUNWARE_NO_IMAGE", code: "RUNWARE_NO_IMAGE", details: { keys: Object.keys(node || {}) } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = (err as Error)?.message || String(err);
    let parsed: Record<string, unknown> | null = null;
    try {
      const parsedValue = JSON.parse(message) as unknown;
      parsed = parsedValue && typeof parsedValue === "object" ? parsedValue as Record<string, unknown> : null;
    } catch {
      parsed = null;
    }

    const stage = parsed?.stage as string | undefined;
    console.error("[wakti-image2image] error", { stage, message, parsed });
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-image2image",
      provider: "runware",
      model: typeof parsed?.model === "string" ? parsed.model : "unknown",
      status: "error",
      errorMessage: message
    });

    return new Response(
      JSON.stringify({
        error: stage || message,
        code: stage ? `I2I_${String(stage).toUpperCase()}` : "UNHANDLED",
        details: parsed || undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
