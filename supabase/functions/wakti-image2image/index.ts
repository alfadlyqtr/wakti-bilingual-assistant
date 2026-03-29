import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL_FAST = Deno.env.get("RUNWARE_FAST_MODEL") || "google:4@1";
const MODEL_BEST = Deno.env.get("RUNWARE_BEST_FAST_MODEL") || "google:4@3";

const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s || "");

async function translateToEnglishIfArabic(prompt: string): Promise<string> {
  try {
    if (!isArabic(prompt)) return prompt;
    if (!OPENAI_API_KEY) return prompt;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert image prompt translator. Translate Arabic image prompts to English for image generation models. Return ONLY the English translation, nothing else." },
          { role: "user", content: `Translate this image prompt to English: ${prompt}` }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
      signal: controller.signal
    });
    clearTimeout(tid);
    if (!resp.ok) return prompt;
    const json = await resp.json().catch(() => null);
    const txt = json?.choices?.[0]?.message?.content?.trim();
    return txt || prompt;
  } catch {
    return prompt;
  }
}

function genUUID(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function findTaskUUID(obj: unknown): string | null {
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
      const found = findTaskUUID(v);
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

async function safeJson(resp: Response): Promise<any> {
  const text = await resp.text();
  if (!text || text.trim().length === 0) return null;
  try { return JSON.parse(text); } catch { return { __raw: text }; }
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
  // For google:4@1 and google:4@3 in i2i mode, omit width/height so the model
  // automatically matches the reference image aspect ratio.
  const payload = [
    { taskType: "authentication", apiKey: RUNWARE_API_KEY },
    {
      taskType: "imageInference",
      taskUUID: genUUID(),
      model,
      positivePrompt: finalPrompt,
      numberResults: 1,
      outputType: ["dataURI", "URL"],
      includeCost: true,
      referenceImages,
      outputQuality: 85,
    }
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RUNWARE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing RUNWARE_API_KEY", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const image_base64_raw = body?.image_base64 as string | undefined;
    const image_base64_raw_2 = body?.image_base64_2 as string | undefined;
    const image_base64s = Array.isArray(body?.image_base64s)
      ? body.image_base64s.filter((v: unknown) => typeof v === "string" && v.trim().length > 0).slice(0, 4) as string[]
      : [];
    const user_prompt = body?.user_prompt as string | undefined;
    const user_id = body?.user_id as string | undefined;
    const quality = body?.quality === "best_fast" ? "best_fast" : "fast";
    const selectedModel = quality === "best_fast" ? MODEL_BEST : MODEL_FAST;

    const inputImages = image_base64s.length > 0
      ? image_base64s
      : [image_base64_raw, image_base64_raw_2].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    if (inputImages.length === 0 || !user_prompt || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing params", code: "BAD_REQUEST_MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Trial Token Check: i2i ──
    const trial = await checkAndConsumeTrialToken(supabase, user_id, 'i2i', 2);
    if (!trial.allowed) {
      return new Response(
        JSON.stringify({ error: 'TRIAL_LIMIT_REACHED', feature: 'i2i' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ── End Trial Token Check ──

    const referenceUrls: string[] = [];
    for (const rawImage of inputImages) {
      const { base64, mimeHint } = stripDataUrlPrefix(rawImage);
      const inputBytes = decodeBase64ToUint8Array(base64);
      const { mime, ext } = detectMimeAndExt(inputBytes, mimeHint);
      const referenceUrl = await uploadAndSignReferenceImage({ base64, mime, ext, userId: user_id });
      referenceUrls.push(referenceUrl);
    }

    const finalPrompt = await translateToEnglishIfArabic(user_prompt);
    const rw = await callRunwareI2I(finalPrompt, referenceUrls, selectedModel);
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

      return new Response(
        JSON.stringify({ success: true, url: stableUrl, model: selectedModel, quality }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "RUNWARE_NO_IMAGE", code: "RUNWARE_NO_IMAGE", details: { keys: Object.keys(node || {}) } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = (err as Error)?.message || String(err);
    let parsed: any = null;
    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = null;
    }

    const stage = parsed?.stage as string | undefined;
    console.error("[wakti-image2image] error", { stage, message, parsed });
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-image2image",
      provider: "runware",
      model: parsed?.model || "unknown",
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
