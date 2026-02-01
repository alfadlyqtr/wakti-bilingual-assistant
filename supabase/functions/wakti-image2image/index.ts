import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

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

async function callRunwareI2I(finalPrompt: string, referenceImageUrl: string): Promise<any> {
  // Using alibaba:wan@2.6-image model with referenceImages (signed URL)
  const payload = {
    taskType: "imageInference",
    taskUUID: genUUID(),
    model: "alibaba:wan@2.6-image",
    positivePrompt: finalPrompt,
    height: 1280,
    width: 1280,
    numberResults: 1,
    outputType: ["dataURI", "URL"],
    outputFormat: "JPEG",
    includeCost: true,
    inputs: {
      referenceImages: [referenceImageUrl],
    },
    outputQuality: 85,
  } as any;

  const doCreate = async () => {
    const r = await fetch("https://api.runware.ai/v1/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([payload]),
    });
    const j = await safeJson(r);
    if (!r.ok || !j) throw new Error(JSON.stringify({ stage: "create", details: j ?? { error: "empty" } }));
    return j;
  };

  let created: any;
  try { created = await doCreate(); }
  catch (_e) { await new Promise((r) => setTimeout(r, 600)); created = await doCreate(); }

  const first = Array.isArray(created) ? created[0] : created;
  if (first?.results?.length || first?.data?.length || first?.output?.length || first?.outputs?.length || first?.media?.length) {
    return first;
  }

  const taskId = findTaskUUID(first) || payload.taskUUID;
  const deadline = Date.now() + 90_000; // 90s
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1200));
    const pr = await fetch("https://api.runware.ai/v1/tasks/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([{ taskUUID: taskId }]),
    });
    const pj = await safeJson(pr);
    if (!pr.ok || !pj) throw new Error(JSON.stringify({ stage: "poll", details: pj ?? { error: "empty" }, sent: [{ taskUUID: taskId }] }));
    const item = Array.isArray(pj) ? pj[0] : pj;
    const status = item?.status || item?.state || item?.taskStatus;
    if (status === "completed" || status === "succeeded" || item?.results?.length || item?.data?.length || item?.output?.length || item?.outputs?.length || item?.media?.length) {
      return item;
    }
    if (status === "failed" || status === "error") throw new Error(JSON.stringify({ stage: "failed", details: item }));
  }
  throw new Error(JSON.stringify({ stage: "timeout" }));
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
    const user_prompt = body?.user_prompt as string | undefined;
    const user_id = body?.user_id as string | undefined;

    if (!image_base64_raw || !user_prompt || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing params", code: "BAD_REQUEST_MISSING_PARAMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { base64, mimeHint } = stripDataUrlPrefix(image_base64_raw);
    const inputBytes = decodeBase64ToUint8Array(base64);
    const { mime, ext } = detectMimeAndExt(inputBytes, mimeHint);

    const referenceUrl = await uploadAndSignReferenceImage({ base64, mime, ext, userId: user_id });

    const rw = await callRunwareI2I(user_prompt, referenceUrl);
    const node = pickFirstResultNode(rw) || rw;

    // Extract the Runware output URL
    const outputImageUrl = node?.imageURL || node?.URL || node?.url;
    
    console.log("🎨 Runware result:", { keys: Object.keys(node || {}), outputImageUrl: outputImageUrl?.slice(0, 80) });

    if (outputImageUrl) {
      // Log successful AI usage
      await logAIFromRequest(req, {
        functionName: "wakti-image2image",
        provider: "runware",
        model: "alibaba:wan@2.6-image",
        inputText: user_prompt,
        status: "success"
      });

      return new Response(
        JSON.stringify({ success: true, url: outputImageUrl, model: "alibaba:wan@2.6-image" }),
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
      model: "alibaba:wan@2.6-image",
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
