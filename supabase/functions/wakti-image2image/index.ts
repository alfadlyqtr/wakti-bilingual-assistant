import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialToken, checkTrialAccess } from "../_shared/trial-tracker.ts";
import { inspectGenerationPrompt } from "../_shared/promptSafety.ts";

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
const KIE_API_BASE_URL = "https://api.kie.ai/api/v1";
const KIE_CREATE_TASK_ENDPOINT = `${KIE_API_BASE_URL}/jobs/createTask`;
const KIE_RECORD_INFO_ENDPOINT = `${KIE_API_BASE_URL}/jobs/recordInfo`;
const KIE_API_KEY = (
  Deno.env.get("KIE_AI_API_KEY")
  || Deno.env.get("KIE_API_KEY")
  || Deno.env.get("NANO_BANANA_API_KEY")
  || Deno.env.get("KIE_BEARER_TOKEN")
  || ""
).trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MODEL_BEST = "nano-banana-2";
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

function normalizeAspectRatio(rawValue: unknown): string {
  const value = String(rawValue || "auto").trim();
  if (NANO_BANANA_SUPPORTED_RATIOS.has(value)) {
    return value;
  }
  return "auto";
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
    const resp = await fetch(`${KIE_RECORD_INFO_ENDPOINT}?taskId=${taskId}`, {
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

async function generateBestWithKie(finalPrompt: string, referenceUrls: string[], aspectRatio: string, callBackUrl?: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const submitResp = await fetch(KIE_CREATE_TASK_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_BEST,
      ...(callBackUrl ? { callBackUrl } : {}),
      input: {
        prompt: finalPrompt,
        image_input: referenceUrls,
        aspect_ratio: aspectRatio,
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const requestedQuality = (body?.quality || "best_fast").toString();
    const quality = "best_fast";
    const selectedModel = MODEL_BEST;
    const aspectRatio = normalizeAspectRatio(body?.aspect_ratio);
    const callbackUrlFromBody = typeof body?.callBackUrl === "string" ? body.callBackUrl.trim() : "";
    const callbackUrlFromEnv = (Deno.env.get("KIE_NANO_BANANA_CALLBACK_URL") || "").trim();
    const callBackUrl = callbackUrlFromBody || callbackUrlFromEnv || undefined;
    const image_base64_raw = (body?.image_base64 || body?.image || "").toString();
    const image_base64_raw_2 = (body?.image_base64_2 || "").toString();
    const image_base64s = Array.isArray(body?.image_base64s) ? body.image_base64s : [];

    const user_prompt = body?.user_prompt as string | undefined;
    const user_id = body?.user_id as string | undefined;
    let trialPayload = null;

    const inputImages = image_base64s.length > 0
      ? image_base64s
      : [image_base64_raw, image_base64_raw_2].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    if (inputImages.length === 0 || !user_prompt || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing params", code: "BAD_REQUEST_MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const promptSafety = inspectGenerationPrompt(user_prompt, body?.language === "ar" ? "ar" : "en");
    if (!promptSafety.allowed) {
      return new Response(
        JSON.stringify({ error: promptSafety.message, code: "UNSAFE_PROMPT_BLOCKED" }),
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

    const finalPrompt = promptSafety.normalizedPrompt;
    const stableUrl = await generateBestWithKie(finalPrompt, referenceUrls, aspectRatio, callBackUrl);

    await logAIFromRequest(req, {
      functionName: "wakti-image2image",
      provider: "kie-nano-banana-2",
      model: selectedModel,
      inputText: user_prompt,
      status: "success",
      metadata: { quality, requestedQuality }
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
      provider: "kie-nano-banana-2",
      model: MODEL_BEST,
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
