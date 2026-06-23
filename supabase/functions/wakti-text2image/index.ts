// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialToken, checkTrialAccess } from "../_shared/trial-tracker.ts";
import { inspectGenerationPrompt } from "../_shared/promptSafety.ts";

// ─── AI Logger (inlined) ───
interface AILogParams {
  functionName: string;
  userId?: string;
  model: string;
  inputText?: string;
  outputText?: string;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function calculateCost(model: string): number {
  // Image generation cost estimate per call
  if (model.includes('111')) return 0.003;
  return 0.002;
}

async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log("[aiLogger] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const inputTokens = estimateTokens(params.inputText);
    const cost = calculateCost(params.model);

    // Call RPC with CORRECT parameter names matching the function signature
    const { error } = await supabase.rpc("log_ai_usage", {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.inputText ? params.inputText.substring(0, 2000) : null,
      p_response: params.outputText ? params.outputText.substring(0, 2000) : null,
      p_metadata: params.metadata || {},
      p_input_tokens: inputTokens,
      p_output_tokens: 0,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: cost,
    });

    if (error) {
      console.error("[aiLogger] RPC error:", error);
    } else {
      console.log(`[aiLogger] ✅ Logged: ${params.functionName} | ${params.model}`);
    }
  } catch (err) {
    console.error("[aiLogger] Error:", err);
  }
}
// ─── End AI Logger ───

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
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
const MODEL_BEST = "nano-banana-2";
const TIMEOUT_MS = parseInt(Deno.env.get("WAKTI_T2I_TIMEOUT_MS") ?? "180000", 10);
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

function extractKieImageUrls(data: any): string[] {
  const urls: string[] = [];
  if (typeof data?.resultJson === "string" && data.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson);
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
  const scan = (obj: any, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 8) return;
    for (const [k, v] of Object.entries(obj)) {
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
  const deadline = Date.now() + TIMEOUT_MS;
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
    const imageUrls = extractKieImageUrls(json?.data);
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

async function generateBestWithKie(prompt: string, aspectRatio: string, callBackUrl?: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const submitResp = await fetch(KIE_CREATE_TASK_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_BEST,
      ...(callBackUrl ? { callBackUrl } : {}),
      input: {
        prompt,
        aspect_ratio: aspectRatio || "auto",
        resolution: "1K",
        output_format: "jpg",
      },
    }),
  });
  const submitText = await submitResp.text();
  if (!submitResp.ok) {
    throw new Error(`KIE submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
  }
  const submitJson = JSON.parse(submitText);
  const taskId = submitJson?.data?.taskId;
  if (!taskId) throw new Error(`No taskId in KIE response: ${submitText.slice(0, 200)}`);
  return await pollKieTaskForImage(taskId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...cors } });
  const startTime = Date.now();
  let usedModel = MODEL_BEST;
  let usedProvider = "kie-nano-banana-2";
  let promptText = "";

  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({ }));
    const prompt = (body?.prompt || "").toString();
    const requestedQuality = (body?.quality || "best_fast").toString();
    const quality = "best_fast";
    const aspectRatio = normalizeAspectRatio(body?.aspect_ratio);
    const callbackUrlFromBody = typeof body?.callBackUrl === "string" ? body.callBackUrl.trim() : "";
    const callbackUrlFromEnv = (Deno.env.get("KIE_NANO_BANANA_CALLBACK_URL") || "").trim();
    const callBackUrl = callbackUrlFromBody || callbackUrlFromEnv || undefined;
    const userId = body?.user_id || null;
    promptText = prompt;
    const supabaseAdmin = userId
      ? createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      : null;

    if (!prompt.trim()) return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

    const promptSafety = inspectGenerationPrompt(prompt, body?.language === "ar" ? "ar" : "en");
    if (!promptSafety.allowed) {
      return new Response(JSON.stringify({ success: false, error: promptSafety.message }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Trial Token Check ──
    if (userId && supabaseAdmin) {
      const trial = await checkTrialAccess(supabaseAdmin, userId, 't2i', 2);
      if (!trial.allowed) {
        return new Response(
          JSON.stringify({ success: false, ...buildTrialErrorPayload('t2i', trial) }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }
    // ── End Trial Token Check ──

    const finalPrompt = promptSafety.normalizedPrompt;
    usedModel = MODEL_BEST;
    usedProvider = "kie-nano-banana-2";

    const url = await generateBestWithKie(finalPrompt, aspectRatio, callBackUrl);
    if (!url) {
      await logAI({
        functionName: "text2image",
        userId,
        model: usedModel,
        inputText: prompt,
        durationMs: Date.now() - startTime,
        status: "error",
        errorMessage: "No image returned",
        metadata: { provider: usedProvider, quality }
      });
      return new Response(JSON.stringify({ success: false, error: "No image returned" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let trialPayload = null;
    if (userId && supabaseAdmin) {
      const consumeTrial = await checkAndConsumeTrialToken(supabaseAdmin, userId, 't2i', 2);
      if (consumeTrial.allowed) {
        trialPayload = buildTrialSuccessPayload('t2i', consumeTrial);
      } else {
        console.warn('[wakti-text2image] Trial consume skipped after success:', consumeTrial.reason);
      }
    }

    // Log successful AI usage
    await logAI({
      functionName: "text2image",
      userId,
      model: usedModel,
      inputText: prompt,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { provider: usedProvider, quality, requestedQuality, translated: false }
    });

    return new Response(JSON.stringify({ success: true, url, model: usedModel, quality, trial: trialPayload }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = String((err as any)?.message || err);
    const normalized = /abort/i.test(msg) ? "Generation timed out. Please try again with a shorter prompt." : msg;

    await logAI({
      functionName: "text2image",
      model: usedModel,
      inputText: promptText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: normalized,
      metadata: { provider: usedProvider }
    });

    return new Response(JSON.stringify({ success: false, error: normalized }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
