import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getUserIdFromRequest } from "./getUserIdFromRequest.ts";

export interface AILogParams {
  functionName: string;
  userId?: string;
  provider: string;
  model: string;
  inputText?: string;
  outputText?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

interface ModelPricing {
  input: number;
  output: number;
  perCall?: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o-mini-transcribe": { input: 0.15, output: 0.60 },
  "gpt-5-nano-2025-08-07": { input: 0.15, output: 0.60 },
  "whisper-1": { input: 0, output: 0, perCall: 0.006 },
  "tts-1": { input: 0, output: 0, perCall: 0.015 },
  "tts-1-hd": { input: 0, output: 0, perCall: 0.030 },
  "dall-e-3": { input: 0, output: 0, perCall: 0.040 },
  "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
  "claude-3-5-sonnet": { input: 3.00, output: 15.00 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "gemini-2.0-flash": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash-exp": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash-001": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-pro": { input: 0.50, output: 1.50 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-coder": { input: 0.14, output: 0.28 },
  "runware:111@1": { input: 0, output: 0, perCall: 0.007 },
  "runware:106@1": { input: 0, output: 0, perCall: 0.015 },
  "runware:97@2": { input: 0, output: 0, perCall: 0.007 },
  "runware:100@1": { input: 0, output: 0, perCall: 0.007 },
  "runware": { input: 0, output: 0, perCall: 0.007 },
  "google:4@1": { input: 0, output: 0, perCall: 0.039 },
  "elevenlabs:1@1": { input: 0, output: 0, perCall: 0.275 },
  "runware-music": { input: 0, output: 0, perCall: 0.275 },
  "elevenlabs": { input: 0, output: 0, perCall: 0.0003 },
  "elevenlabs-tts": { input: 0, output: 0, perCall: 0.0003 },
  "elevenlabs-clone": { input: 0, output: 0, perCall: 0.30 },
  "google-tts": { input: 0, output: 0, perCall: 0.004 },
  "google-tts-chirp3": { input: 0, output: 0, perCall: 0.016 },
  "tavily": { input: 0, output: 0, perCall: 0.016 },
  "tavily-basic": { input: 0, output: 0, perCall: 0.008 },
  "tavily-advanced": { input: 0, output: 0, perCall: 0.016 },
  "wolfram": { input: 0, output: 0, perCall: 0.0025 },
  "wolfram-alpha": { input: 0, output: 0, perCall: 0.0025 },
  "default": { input: 0.10, output: 0.40 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  inputText?: string
): number {
  const normalizedModel = model.toLowerCase().trim();

  let pricing = MODEL_PRICING[normalizedModel];

  if (!pricing) {
    for (const [key, value] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        pricing = value;
        break;
      }
    }
  }

  if (!pricing) {
    pricing = MODEL_PRICING["default"];
  }

  if (pricing.perCall && pricing.perCall > 0) {
    if (normalizedModel.includes("elevenlabs") && !normalizedModel.includes("clone") && !normalizedModel.includes("music") && inputText) {
      const charCount = inputText.length;
      return charCount * pricing.perCall;
    }

    if (normalizedModel.includes("tts") && inputText) {
      const charCount = inputText.length;
      return (charCount / 1000) * pricing.perCall;
    }

    if (normalizedModel.includes("google-tts") && inputText) {
      const charCount = inputText.length;
      return (charCount / 1_000_000) * (pricing.perCall * 1000);
    }

    return pricing.perCall;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[aiLogger] Missing Supabase credentials, skipping log");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const inputTokens = params.inputTokens ?? estimateTokens(params.inputText);
    const outputTokens = params.outputTokens ?? estimateTokens(params.outputText);

    const cost = calculateCost(params.model, inputTokens, outputTokens, params.inputText);

    const { error } = await supabase.rpc("log_ai_usage", {
      p_user_id: params.userId || null,
      p_function_name: params.functionName,
      p_model: params.model,
      p_status: params.status,
      p_error_message: params.errorMessage || null,
      p_prompt: params.inputText ? params.inputText.substring(0, 2000) : null,
      p_response: params.outputText ? params.outputText.substring(0, 2000) : null,
      p_metadata: params.metadata ? { ...params.metadata, provider: params.provider } : { provider: params.provider },
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_duration_ms: params.durationMs || 0,
      p_cost_credits: cost,
    });

    if (error) {
      console.error("[aiLogger] Failed to log AI usage:", error.message);
    } else {
      console.log(
        `[aiLogger] ✅ Logged: ${params.functionName} | ${params.provider}/${params.model} | ${inputTokens}+${outputTokens} tokens | $${cost.toFixed(6)}`
      );
    }
  } catch (err) {
    console.error("[aiLogger] Error logging AI usage:", err);
  }
}

export type AILogParamsWithoutUserId = Omit<AILogParams, "userId">;

export async function logAIFromRequest(
  req: Request,
  params: AILogParamsWithoutUserId
): Promise<void> {
  const userId = getUserIdFromRequest(req) ?? undefined;
  await logAI({ ...params, userId });
}
