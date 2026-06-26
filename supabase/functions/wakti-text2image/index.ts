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
const RUNWARE_API_KEY = (Deno.env.get("RUNWARE_API_KEY") || "").trim();
const MODEL_FAST = Deno.env.get("RUNWARE_FAST_MODEL") || "openai:gpt-image@2";
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

const RETRYABLE_GENERATION_ERROR_PATTERN = /unexpected end of file|error reading a body from connection|connection (?:reset|closed|aborted)|socket hang up|econnreset|etimedout|network\s*error|failed to fetch|generation timed out|timed out|timeout|bad gateway|service unavailable|gateway timeout|http\s*5\d\d|runware\s*error\s*5\d\d|abort/i;
const SAFETY_BLOCK_PATTERN = /content\s*safety|safety\s*restriction|safety\s*policy|unsafe_prompt_blocked|prompt\s*blocked|moderation|can't help with that request|cannot assist with|policy\s*filter|content\s*policy|\b431\b/i;
const NON_RETRYABLE_PATTERN = /missing prompt|missing image|missing params|bad_request|method not allowed|unsupported|authentication required|please log in first/i;
const USER_ACTIONABLE_PATTERN = /missing prompt|authentication required|please log in first|method not allowed/i;
const PROVIDER_LEAK_PATTERN = /runware|openai|gpt-image|kie|api\.kie\.ai|grok-imagine|nano-banana|provider/i;

type UiLanguage = "ar" | "en";

interface StageErrorData {
  stage: string;
  message: string;
  taskId?: string;
}

interface ParsedStageError extends StageErrorData {
  rawMessage: string;
}

interface PublicErrorPayload {
  message: string;
  code: string;
  retryable: boolean;
}

function normalizeAspectRatio(rawValue: unknown): string {
  const value = String(rawValue || "auto").trim();
  if (NANO_BANANA_SUPPORTED_RATIOS.has(value)) {
    return value;
  }
  return "auto";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

function hashPromptText(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash |= 0;
  }
  const normalized = hash >>> 0;
  return normalized.toString(16).padStart(8, "0");
}

function buildStageError(stage: string, message: string, taskId?: string): Error {
  return new Error(JSON.stringify({ stage, message, taskId }));
}

function parseStageError(error: unknown): ParsedStageError {
  const rawMessage = toErrorMessage(error);
  try {
    const parsed = JSON.parse(rawMessage) as unknown;
    if (parsed && typeof parsed === "object") {
      const stage = typeof (parsed as Record<string, unknown>).stage === "string"
        ? (parsed as Record<string, unknown>).stage as string
        : "unhandled";
      const message = typeof (parsed as Record<string, unknown>).message === "string"
        ? (parsed as Record<string, unknown>).message as string
        : rawMessage;
      const taskId = typeof (parsed as Record<string, unknown>).taskId === "string"
        ? (parsed as Record<string, unknown>).taskId as string
        : undefined;
      return { stage, message, taskId, rawMessage };
    }
  } catch {
    // non-json error payload
  }
  return { stage: "unhandled", message: rawMessage, rawMessage };
}

function isRetryableGenerationError(error: unknown): boolean {
  const parsed = parseStageError(error);
  const text = `${parsed.message} ${parsed.rawMessage}`;
  return RETRYABLE_GENERATION_ERROR_PATTERN.test(text)
    && !SAFETY_BLOCK_PATTERN.test(text)
    && !NON_RETRYABLE_PATTERN.test(text);
}

function mapToPublicError(rawMessage: string, language: UiLanguage): PublicErrorPayload {
  const lower = rawMessage.toLowerCase();
  const hasProviderLeak = PROVIDER_LEAK_PATTERN.test(rawMessage);

  if (SAFETY_BLOCK_PATTERN.test(lower)) {
    return {
      message: language === "ar"
        ? "تم حظر هذا الطلب بسبب سياسة الأمان. عدّل الوصف ثم حاول مرة أخرى."
        : "This request was blocked by safety policy. Please adjust the prompt and try again.",
      code: "UNSAFE_PROMPT_BLOCKED",
      retryable: false,
    };
  }

  if (/missing prompt/.test(lower)) {
    return {
      message: language === "ar" ? "اكتب وصفاً للصورة" : "Enter an image description",
      code: "BAD_REQUEST_MISSING_PROMPT",
      retryable: false,
    };
  }

  const retryable = RETRYABLE_GENERATION_ERROR_PATTERN.test(lower)
    && !NON_RETRYABLE_PATTERN.test(lower);

  if (retryable) {
    return {
      message: language === "ar"
        ? "حدث خلل مؤقت في خدمة الصور. حاول مرة أخرى."
        : "Temporary image service issue. Please try again.",
      code: "TEMPORARY_SERVICE_ISSUE",
      retryable: true,
    };
  }

  if (USER_ACTIONABLE_PATTERN.test(lower) && !hasProviderLeak) {
    return {
      message: rawMessage,
      code: "REQUEST_INVALID",
      retryable: false,
    };
  }

  return {
    message: language === "ar"
      ? "تعذر إنشاء الصورة الآن. حاول مرة أخرى."
      : "Image generation failed. Please try again.",
    code: "IMAGE_GENERATION_FAILED",
    retryable: false,
  };
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
  if (!KIE_API_KEY) throw buildStageError("config", "Image provider is not configured");
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const resp = await fetch(`${KIE_RECORD_INFO_ENDPOINT}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    const rawText = await resp.text();
    if (!resp.ok) {
      throw buildStageError("provider_poll_http", `KIE poll failed ${resp.status}: ${rawText.slice(0, 200)}`, taskId);
    }
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      throw buildStageError("provider_poll_parse", "Image status response was invalid", taskId);
    }
    const rawStatus = (json?.data?.state || json?.data?.status || json?.data?.taskStatus || "").toString().toLowerCase();
    const imageUrls = extractKieImageUrls(json?.data);
    const isDone = rawStatus === "success" || rawStatus === "completed" || rawStatus === "finished"
      || rawStatus === "succeed" || rawStatus === "done" || rawStatus === "2";
    const isFailed = rawStatus === "failed" || rawStatus === "error" || rawStatus === "fail" || rawStatus === "3";
    if (isFailed) {
      throw buildStageError("provider_poll_failed", `KIE task failed: ${rawStatus}`, taskId);
    }
    if ((isDone || imageUrls.length > 0) && imageUrls[0]) {
      return imageUrls[0];
    }
  }
  throw buildStageError("provider_poll_timeout", "KIE generation timed out", taskId);
}

async function generateBestWithKie(prompt: string, aspectRatio: string, callBackUrl?: string): Promise<{ url: string; taskId: string }> {
  if (!KIE_API_KEY) throw buildStageError("config", "Image provider is not configured");
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
    throw buildStageError("provider_submit_http", `KIE submit failed ${submitResp.status}: ${submitText.slice(0, 200)}`);
  }
  let submitJson: any;
  try {
    submitJson = JSON.parse(submitText);
  } catch {
    throw buildStageError("provider_submit_parse", "Image submit response was invalid");
  }
  const taskId = submitJson?.data?.taskId;
  if (!taskId) throw buildStageError("provider_submit_missing_task_id", "No task ID returned from image provider");
  const url = await pollKieTaskForImage(taskId);
  return { url, taskId };
}

async function runBestGenerationWithRetry(prompt: string, aspectRatio: string, callBackUrl?: string): Promise<{ url: string; taskId: string; attempts: number }> {
  try {
    const firstAttempt = await generateBestWithKie(prompt, aspectRatio, callBackUrl);
    return { ...firstAttempt, attempts: 1 };
  } catch (firstError) {
    if (!isRetryableGenerationError(firstError)) {
      throw firstError;
    }
    await delay(1200);
    const secondAttempt = await generateBestWithKie(prompt, aspectRatio, callBackUrl);
    return { ...secondAttempt, attempts: 2 };
  }
}

function getDimensionsForModel(model: string, aspectRatio: "9:16" | "16:9"): { width: number; height: number } {
  const isLandscape = aspectRatio === "16:9";
  if (model === "google:4@3") return isLandscape ? { width: 2752, height: 1536 } : { width: 1536, height: 2752 };
  if (model === "google:4@2") return isLandscape ? { width: 1376, height: 768 } : { width: 768, height: 1376 };
  if (model === "openai:gpt-image@2") return isLandscape ? { width: 1536, height: 1024 } : { width: 1024, height: 1536 };
  return isLandscape ? { width: 1344, height: 768 } : { width: 768, height: 1344 };
}

const IMAGE_URL_KEYS = ["imageURL", "URL", "url", "outputUrl", "outputURL"] as const;
const IMAGE_DATAURI_KEYS = ["imageDataURI", "dataURI", "dataUrl", "data_uri"] as const;

function findFirstImage(node: unknown): { url?: string; dataURI?: string } | null {
  const visited = new Set<object>();
  function dfs(obj: any): { url?: string; dataURI?: string } | null {
    if (!obj || typeof obj !== "object" || visited.has(obj)) return null;
    visited.add(obj);
    for (const k of IMAGE_URL_KEYS) if (typeof obj[k] === "string" && obj[k]) return { url: obj[k] };
    for (const k of IMAGE_DATAURI_KEYS) if (typeof obj[k] === "string" && obj[k]) return { dataURI: obj[k] };
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const got = dfs(it);
        if (got) return got;
      }
    } else {
      for (const key in obj) {
        const got = dfs(obj[key]);
        if (got) return got;
      }
    }
    return null;
  }
  return dfs(node);
}

async function runwareGenerate(
  positivePrompt: string,
  model: string,
  aspectRatio: "9:16" | "16:9",
  signal?: AbortSignal,
): Promise<{ url: string | null }> {
  if (!RUNWARE_API_KEY) {
    throw buildStageError("config", "RUNWARE_API_KEY not configured");
  }

  const { width, height } = getDimensionsForModel(model, aspectRatio);
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
    inferenceTask.providerSettings = { openai: { quality: "low" } };
  }

  if (!isGoogleModel && !isOpenAIImageModel) {
    inferenceTask.outputFormat = "WEBP";
  }

  const payload = [
    { taskType: "authentication", apiKey: RUNWARE_API_KEY },
    inferenceTask,
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();

    if (!res.ok) {
      throw buildStageError("provider_submit_http", `Runware error ${res.status}: ${text?.slice(0, 200) || ""}`);
    }
    if (!text) {
      throw buildStageError("provider_submit_empty", "Runware returned an empty response");
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw buildStageError("provider_submit_parse", "Runware returned invalid JSON");
    }

    const found = findFirstImage(data);
    return { url: found?.url || found?.dataURI || null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runwareGenerateWithRetry(
  positivePrompt: string,
  model: string,
  aspectRatio: "9:16" | "16:9",
  signal?: AbortSignal,
): Promise<{ url: string | null; attempts: number }> {
  try {
    const firstAttempt = await runwareGenerate(positivePrompt, model, aspectRatio, signal);
    return { ...firstAttempt, attempts: 1 };
  } catch (firstError) {
    if (!isRetryableGenerationError(firstError)) {
      throw firstError;
    }
    await delay(1200);
    const secondAttempt = await runwareGenerate(positivePrompt, model, aspectRatio, signal);
    return { ...secondAttempt, attempts: 2 };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...cors } });
  const startTime = Date.now();
  let usedModel = MODEL_FAST;
  let usedProvider = "runware";
  let promptText = "";
  let language: UiLanguage = "en";
  let promptHash = "";
  let providerTaskId: string | undefined;
  let failureStage = "request";
  let userIdForLog: string | undefined;
  let requestedQuality = "fast";

  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({ }));
    const prompt = (body?.prompt || "").toString();
    requestedQuality = (body?.quality || "fast").toString();
    const quality = requestedQuality === "best_fast" ? "best_fast" : "fast";
    const aspectRatio = normalizeAspectRatio(body?.aspect_ratio);
    const runwareAspectRatio: "9:16" | "16:9" = body?.aspect_ratio === "16:9" ? "16:9" : "9:16";
    const callbackUrlFromBody = typeof body?.callBackUrl === "string" ? body.callBackUrl.trim() : "";
    const callbackUrlFromEnv = (Deno.env.get("KIE_NANO_BANANA_CALLBACK_URL") || "").trim();
    const callBackUrl = callbackUrlFromBody || callbackUrlFromEnv || undefined;
    const userId = body?.user_id || null;
    userIdForLog = userId || undefined;
    language = body?.language === "ar" ? "ar" : "en";
    promptText = prompt;
    promptHash = hashPromptText(prompt);
    const supabaseAdmin = userId
      ? createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      : null;

    if (!prompt.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: language === "ar" ? "اكتب وصفاً للصورة" : "Enter an image description",
          code: "BAD_REQUEST_MISSING_PROMPT",
          retryable: false,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const promptSafety = inspectGenerationPrompt(prompt, language);
    if (!promptSafety.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: promptSafety.message, code: "UNSAFE_PROMPT_BLOCKED", retryable: false }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
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
    usedModel = quality === "best_fast" ? MODEL_BEST : MODEL_FAST;
    usedProvider = quality === "best_fast" ? "kie-nano-banana-2" : "runware";

    let url: string | null = null;
    let attempts = 1;
    if (quality === "best_fast") {
      failureStage = "provider_generation";
      const generationResult = await runBestGenerationWithRetry(finalPrompt, aspectRatio, callBackUrl);
      providerTaskId = generationResult.taskId;
      url = generationResult.url;
      attempts = generationResult.attempts;
    } else {
      failureStage = "provider_generation";
      const generationResult = await runwareGenerateWithRetry(finalPrompt, usedModel, runwareAspectRatio, req.signal);
      url = generationResult.url;
      attempts = generationResult.attempts;
    }

    if (!url) {
      failureStage = "empty_result";
      await logAI({
        functionName: "text2image",
        userId,
        model: usedModel,
        inputText: prompt,
        durationMs: Date.now() - startTime,
        status: "error",
        errorMessage: "No image returned",
        metadata: { provider: usedProvider, quality, requestedQuality, stage: failureStage, taskId: providerTaskId, promptHash }
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: language === "ar" ? "تعذر إنشاء الصورة الآن. حاول مرة أخرى." : "Image generation failed. Please try again.",
          code: "IMAGE_GENERATION_FAILED",
          retryable: false,
          stage: failureStage,
          taskId: providerTaskId,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
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
      metadata: {
        provider: usedProvider,
        quality,
        requestedQuality,
        translated: false,
        stage: "success",
        taskId: providerTaskId,
        promptHash,
        attempts,
      }
    });

    return new Response(JSON.stringify({ success: true, url, model: usedModel, quality, trial: trialPayload, taskId: providerTaskId }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const parsedError = parseStageError(err);
    failureStage = parsedError.stage || failureStage;
    if (!providerTaskId && parsedError.taskId) {
      providerTaskId = parsedError.taskId;
    }
    const publicError = mapToPublicError(parsedError.message, language);

    await logAI({
      functionName: "text2image",
      userId: userIdForLog,
      model: usedModel,
      inputText: promptText,
      durationMs: Date.now() - startTime,
      status: "error",
      errorMessage: parsedError.message,
      metadata: {
        provider: usedProvider,
        stage: failureStage,
        taskId: providerTaskId,
        promptHash,
        requestedQuality,
        retryable: publicError.retryable,
        code: publicError.code,
        rawError: parsedError.rawMessage.slice(0, 500),
      }
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: publicError.message,
        code: publicError.code,
        retryable: publicError.retryable,
        stage: failureStage,
        taskId: providerTaskId,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
