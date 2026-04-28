// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialToken, checkTrialAccess } from "../_shared/trial-tracker.ts";

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
  // Runware image gen ~$0.002-0.003 per call
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
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const KIE_API_KEY = Deno.env.get("KIE_API_KEY");

const MODEL_FAST = Deno.env.get("RUNWARE_FAST_MODEL") || "openai:gpt-image@2";
const MODEL_BEST = "nano-banana-2";
// google:4@1 valid 9:16 = 768x1344 | google:4@3 valid 9:16 = 1536x2752
const STEPS = parseInt(Deno.env.get("WAKTI_T2I_STEPS") ?? "28", 10);
const CFG = parseFloat(Deno.env.get("WAKTI_T2I_CFG") ?? "5.5");
const TIMEOUT_MS = parseInt(Deno.env.get("WAKTI_T2I_TIMEOUT_MS") ?? "180000", 10);

function isRetryableRunwareErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("runware error 502")
    || normalized.includes("runware error 503")
    || normalized.includes("runware error 504")
    || normalized.includes("timed out")
    || normalized.includes("abort");
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
    const resp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
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

async function generateBestWithKie(prompt: string, aspectRatio: string): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
  const submitResp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_BEST,
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

function getDimensionsForModel(model: string): { width: number; height: number } {
  if (model === "google:4@3") return { width: 1536, height: 2752 };
  if (model === "google:4@2") return { width: 768, height: 1376 };
  if (model === "openai:gpt-image@2") return { width: 1024, height: 1536 };
  // google:4@1 and fallback: 768x1344 (9:16)
  return { width: 768, height: 1344 };
}

const IMAGE_URL_KEYS = ["imageURL", "URL", "url", "outputUrl", "outputURL"] as const;
const IMAGE_DATAURI_KEYS = ["imageDataURI", "dataURI", "dataUrl", "data_uri"] as const;

function findFirstImage(node: unknown): { url?: string; dataURI?: string } | null {
  const visited = new Set<object>();
  function dfs(obj: any): { url?: string; dataURI?: string } | null {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
    visited.add(obj);
    for (const k of IMAGE_URL_KEYS) if (typeof obj[k] === 'string' && obj[k]) return { url: obj[k] };
    for (const k of IMAGE_DATAURI_KEYS) if (typeof obj[k] === 'string' && obj[k]) return { dataURI: obj[k] };
    if (Array.isArray(obj)) { for (const it of obj) { const got = dfs(it); if (got) return got; } }
    else { for (const key in obj) { const got = dfs(obj[key]); if (got) return got; } }
    return null;
  }
  return dfs(node);
}

async function runwareGenerate(positivePrompt: string, model: string, signal?: AbortSignal) {
  const { width, height } = getDimensionsForModel(model);
  const isGoogleModel = model.startsWith("google:");
  const isOpenAIImageModel = model.startsWith("openai:gpt-image");
  const inferenceTask: Record<string, unknown> = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt,
    width,
    height,
    model,
    numberResults: 1,
    outputType: ["URL", "dataURI"],
    includeCost: true,
    outputQuality: 85,
  };
  if (isOpenAIImageModel) {
    inferenceTask.providerSettings = {
      openai: {
        quality: "low",
      },
    };
  }
  if (!isGoogleModel && !isOpenAIImageModel) {
    inferenceTask.outputFormat = "WEBP";
    inferenceTask.CFGScale = CFG;
    inferenceTask.steps = STEPS;
  }
  const payload = [
    { taskType: "authentication", apiKey: RUNWARE_API_KEY },
    inferenceTask
  ];
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort());
  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Runware error ${res.status}: ${text?.slice(0, 200)}`);
    if (!text) throw new Error("Empty response from Runware");
    let data: any;
    try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON from Runware"); }
    const found = findFirstImage(data);
    const url = found?.url || found?.dataURI || null;
    return { url };
  } finally { clearTimeout(tid); }
}

async function runwareGenerateWithRetry(positivePrompt: string, model: string, signal?: AbortSignal) {
  try {
    return await runwareGenerate(positivePrompt, model, signal);
  } catch (err) {
    const message = String((err as any)?.message || err || "");
    if (!isRetryableRunwareErrorMessage(message)) throw err;
    return await runwareGenerate(positivePrompt, model, signal);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...cors } });
  const startTime = Date.now();
  let usedModel = MODEL_FAST;
  let usedProvider = "runware";
  let promptText = "";

  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({ }));
    const prompt = (body?.prompt || "").toString();
    const quality = (body?.quality || "fast").toString();
    const userId = body?.user_id || null;
    promptText = prompt;
    const supabaseAdmin = userId
      ? createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      : null;

    if (!prompt.trim()) return new Response(JSON.stringify({ success: false, error: "Missing prompt" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

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

    const finalPrompt = prompt;
    usedModel = quality === "best_fast" ? MODEL_BEST : MODEL_FAST;
    usedProvider = quality === "best_fast" ? "kie-nano-banana-2" : "runware";

    let url: string | null = null;
    if (quality === "best_fast") {
      url = await generateBestWithKie(finalPrompt, (body?.aspect_ratio || "9:16").toString());
    } else {
      if (!RUNWARE_API_KEY) {
        return new Response(JSON.stringify({ success: false, error: "RUNWARE_API_KEY not configured" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const result = await runwareGenerateWithRetry(finalPrompt, usedModel, req.signal);
      url = result.url;
    }
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
      metadata: { provider: usedProvider, quality, translated: false }
    });

    return new Response(JSON.stringify({ success: true, url, model: usedModel, quality, trial: trialPayload }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = String((err as any)?.message || err);
    const normalized = /abort/i.test(msg) ? "Generation timed out. Please try again with a shorter prompt or try Fast quality." : msg;

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
