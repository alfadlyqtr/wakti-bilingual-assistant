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
    const aspectRatio: string = body?.aspect_ratio || "9:16";
    // If taskId is provided, this is a poll request — check status and return images if ready
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
        // Return KIE URLs directly — frontend saves the selected image when user picks one
        await logAIFromRequest(req, {
          functionName: "wakti-grok-text2image",
          provider: "kie-grok",
          model: "grok-imagine/text-to-image",
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

    // ── SUBMIT MODE: translate prompt and submit task, return taskId immediately ──
    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId) {
      const trial = await checkAndConsumeTrialToken(supabase, userId, "t2i", 2);
      if (!trial.allowed) {
        return new Response(JSON.stringify({ success: false, error: "TRIAL_LIMIT_REACHED", feature: "t2i" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const finalPrompt = await translateToEnglishIfArabic(prompt);
    console.log(`[grok-t2i] submit prompt="${finalPrompt.slice(0, 100)}" aspect=${aspectRatio}`);

    const submitResp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-imagine/text-to-image",
        input: { prompt: finalPrompt, aspect_ratio: aspectRatio },
      }),
    });
    const submitText = await submitResp.text();
    console.log(`[grok-t2i] submit HTTP:${submitResp.status} body:${submitText.slice(0, 400)}`);

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
      model: "grok-imagine/text-to-image",
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
