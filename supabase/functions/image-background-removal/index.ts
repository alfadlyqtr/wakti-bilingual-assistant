import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STORAGE_BUCKET = "generated-files";
const SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const KIE_MODEL = "recraft/remove-background";

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function stripDataUrlPrefix(maybeDataUrl?: string): { base64: string; mimeHint?: string } {
  if (maybeDataUrl && maybeDataUrl.startsWith("data:")) {
    const [meta, data] = maybeDataUrl.split(",", 2);
    const match = /data:([^;]+);base64/.exec(meta || "");
    const mime = match?.[1];
    return { base64: data || "", mimeHint: mime };
  }
  return { base64: maybeDataUrl || "" };
}

function detectMimeAndExt(bytes: Uint8Array, mimeHint?: string): { mime: string; ext: string } {
  if (mimeHint && (mimeHint === "image/png" || mimeHint === "image/jpeg" || mimeHint === "image/webp")) {
    return {
      mime: mimeHint,
      ext: mimeHint === "image/png" ? "png" : mimeHint === "image/jpeg" ? "jpg" : "webp",
    };
  }
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  return { mime: mimeHint || "image/png", ext: mimeHint === "image/jpeg" ? "jpg" : mimeHint === "image/webp" ? "webp" : "png" };
}

const IMAGE_URL_KEYS = ["imageURL", "URL", "url", "outputUrl", "outputURL"];

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

async function uploadAndSignReferenceImage(params: { input: string; userId: string; index: number }): Promise<string> {
  const { input, userId, index } = params;
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage not configured");
  }

  const { base64, mimeHint } = stripDataUrlPrefix(input);
  if (!base64) {
    throw new Error("Invalid image data");
  }
  const bytes = decodeBase64ToUint8Array(base64);
  const { mime, ext } = detectMimeAndExt(bytes, mimeHint);
  const path = `bg-removal-input/${userId}/${Date.now()}-${index}-${uuid()}.${ext}`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });

  if (upload.error) {
    throw new Error(`Storage upload failed: ${upload.error.message}`);
  }

  const signed = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signed.error?.message || "Unknown error"}`);
  }

  return signed.data.signedUrl;
}

async function pollKieTaskForImage(taskId: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const resp = await fetch(`${KIE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
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

async function submitKieBackgroundRemoval(imageUrl: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const submitResp = await fetch(KIE_CREATE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIE_MODEL,
      input: { image: imageUrl },
    }),
  });
  const submitText = await submitResp.text();
  if (!submitResp.ok) {
    throw new Error(`KIE submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
  }
  const submitJson = JSON.parse(submitText);
  const taskId = submitJson?.data?.taskId;
  if (!taskId) {
    throw new Error(`No taskId in KIE response: ${submitText.slice(0, 200)}`);
  }
  return await pollKieTaskForImage(taskId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    if (!KIE_API_KEY) {
      return new Response(JSON.stringify({ error: "KIE API key not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "POST, OPTIONS" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    let authenticatedUserId = "anonymous";

    // ── Trial Token Check: bg_removal ──
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (authHeader) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        authenticatedUserId = user.id;
        const trial = await checkAndConsumeTrialToken(supabaseAdmin, user.id, 'bg_removal', 2);
        if (!trial.allowed) {
          return new Response(
            JSON.stringify({ error: 'TRIAL_LIMIT_REACHED', feature: 'bg_removal' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    // ── End Trial Token Check ──

    const imagesToProcess: unknown[] = [];
    if (Array.isArray(body?.referenceImages)) {
      imagesToProcess.push(...(body.referenceImages as unknown[]));
    } else if (body?.image) {
      imagesToProcess.push(body.image);
    }

    if (imagesToProcess.length === 0) {
      return new Response(JSON.stringify({
        error: "image missing",
        hint: "provide 'referenceImages' or 'image'",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imagesToProcess.length > 3) {
      return new Response(JSON.stringify({ error: "Too many images (max 3)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process all images (edit/enhance)
    const results: Array<{ index: number; imageUrl?: string; imageDataURI?: string }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < imagesToProcess.length; i++) {
      try {
        const inputImage = String(imagesToProcess[i] || "").trim();
        if (!inputImage) {
          errors.push({ index: i, error: "Invalid image data" });
          continue;
        }
        const sourceUrl = await uploadAndSignReferenceImage({ input: inputImage, userId: authenticatedUserId, index: i });
        const outputUrl = await submitKieBackgroundRemoval(sourceUrl);
        results.push({ index: i, imageUrl: outputUrl });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push({ index: i, error: msg });
      }
    }

    if (results.length > 0) {
      if (imagesToProcess.length === 1 && results.length === 1) {
        return new Response(JSON.stringify({
          provider: "kie",
          model: KIE_MODEL,
          imageUrl: results[0].imageUrl,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        provider: "kie",
        model: KIE_MODEL,
        results: results.map((r) => ({ imageUrl: r.imageUrl })),
        errors: errors.length > 0 ? errors : undefined,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "All images failed",
      errors,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      error: "Failed to process background edit",
      details: msg,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
