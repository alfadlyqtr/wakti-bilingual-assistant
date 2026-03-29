// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KIE_API_KEY = Deno.env.get("KIE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const STORAGE_BUCKET = "generated-files";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
          { role: "system", content: "Translate Arabic image prompts to English. Return ONLY the English translation." },
          { role: "user", content: `Translate this to English: ${prompt}` },
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) return prompt;
    const j = await resp.json();
    return j?.choices?.[0]?.message?.content?.trim() || prompt;
  } catch {
    return prompt;
  }
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

// Upload reference image to Supabase and return a signed URL valid for 15 min (enough for KIE to fetch)
async function uploadReferenceImage(base64: string, mimeHint: string | undefined, userId: string): Promise<string> {
  const bytes = decodeBase64ToUint8Array(base64);
  const { mime, ext } = detectMimeAndExt(bytes, mimeHint);
  const path = `grok-i2i-input/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Reference upload failed: ${error.message}`);
  // Private bucket — use a 15-minute signed URL so KIE can download the reference image
  const { data: signed, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 15 * 60);
  if (signErr || !signed?.signedUrl) throw new Error("Could not create signed URL for reference image");
  return signed.signedUrl;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = (body?.user_prompt || body?.prompt || "").toString().trim();
    const image_base64_raw: string = body?.image_base64 || "";
    const userId: string = body?.user_id || "";
    // If taskId is provided, this is a poll request
    const taskId: string = body?.taskId || "";

    if (!KIE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "KIE_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POLL MODE: frontend sends taskId to check status ──
    if (taskId) {
      const resp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const rawText = await resp.text();
      console.log(`[grok-i2i] poll taskId=${taskId} HTTP:${resp.status} body:${rawText.slice(0, 600)}`);

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
        return new Response(JSON.stringify({ success: false, status: "failed", error: `KIE task failed: ${rawStatus}` }), {
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
        // Return KIE URLs directly — frontend saves the selected image when user picks one
        await logAIFromRequest(req, {
          functionName: "wakti-grok-image2image",
          provider: "kie-grok",
          model: "grok-imagine/image-to-image",
          status: "success",
          durationMs: Date.now() - startTime,
        });
        return new Response(
          JSON.stringify({ success: true, status: "done", urls: imageUrls, count: imageUrls.length }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      return new Response(
        JSON.stringify({ success: true, status: "pending", rawStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SUBMIT MODE: upload reference image, submit task, return taskId immediately ──
    if (!image_base64_raw) {
      return new Response(JSON.stringify({ success: false, error: "Missing image" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId) {
      const trial = await checkAndConsumeTrialToken(supabase, userId, "i2i", 2);
      if (!trial.allowed) {
        return new Response(JSON.stringify({ success: false, error: "TRIAL_LIMIT_REACHED", feature: "i2i" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { base64, mimeHint } = stripDataUrlPrefix(image_base64_raw);
    const referencePublicUrl = await uploadReferenceImage(base64, mimeHint, userId || "anon");
    console.log(`[grok-i2i] reference uploaded: ${referencePublicUrl}`);

    const finalPrompt = await translateToEnglishIfArabic(prompt);
    const promptWithRef = finalPrompt ? `@image1 ${finalPrompt}` : "@image1";
    console.log(`[grok-i2i] submit prompt="${promptWithRef.slice(0, 100)}"`);

    const submitResp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-imagine/image-to-image",
        input: { prompt: promptWithRef, image_urls: [referencePublicUrl] },
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
      provider: "kie-grok",
      model: "grok-imagine/image-to-image",
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
