/**
 * AI Usage Logger - Shared helper for logging AI usage across all edge functions
 * 
 * Usage:
 *   import { logAI } from "../_shared/aiLogger.ts";
 *   
 *   await logAI({
 *     functionName: "generate-image",
 *     userId: user.id,
 *     provider: "runware",
 *     model: "runware:97@2",
 *     inputText: prompt,
 *     outputText: "", // or response text for LLMs
 *     durationMs: Date.now() - startTime,
 *     status: "success"
 *   });
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Token Estimation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate token count from text using character-based approximation
 * ~4 characters per token is a reasonable average for English/Arabic mixed content
 */
export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Calculation - Pricing per 1M tokens (or per unit for non-token APIs)
// ─────────────────────────────────────────────────────────────────────────────

interface ModelPricing {
  input: number;  // $ per 1M tokens (or per call for image/audio)
  output: number; // $ per 1M tokens (or 0 for non-token APIs)
  perCall?: number; // Fixed cost per API call (for image gen, TTS, etc.)
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // ─── OpenAI ───
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o-mini-transcribe": { input: 0.15, output: 0.60 },
  "gpt-5-nano-2025-08-07": { input: 0.15, output: 0.60 }, // Assuming similar to mini
  "whisper-1": { input: 0, output: 0, perCall: 0.006 }, // $0.006 per minute
  "tts-1": { input: 0, output: 0, perCall: 0.015 }, // $15 per 1M chars ≈ $0.015 per 1K chars
  "tts-1-hd": { input: 0, output: 0, perCall: 0.030 },
  "dall-e-3": { input: 0, output: 0, perCall: 0.040 }, // $0.04 per image (1024x1024)
  
  // ─── Anthropic/Claude ───
  "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
  "claude-3-5-sonnet": { input: 3.00, output: 15.00 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  
  // ─── Google/Gemini ───
  "gemini-2.0-flash": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash-exp": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash-001": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-pro": { input: 0.50, output: 1.50 },
  
  // ─── DeepSeek ───
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-coder": { input: 0.14, output: 0.28 },
  
  // ─── Runware (Image Generation) ───
  "runware:97@2": { input: 0, output: 0, perCall: 0.002 }, // ~$0.002 per image
  "runware:100@1": { input: 0, output: 0, perCall: 0.002 },
  "runware:106@1": { input: 0, output: 0, perCall: 0.003 },
  "runware": { input: 0, output: 0, perCall: 0.002 }, // Default Runware
  
  // ─── ElevenLabs (Voice Cloning/TTS) ───
  "elevenlabs": { input: 0, output: 0, perCall: 0.018 }, // ~$18 per 1M chars
  "elevenlabs-clone": { input: 0, output: 0, perCall: 0.30 }, // Voice clone creation
  
  // ─── Google TTS ───
  "google-tts": { input: 0, output: 0, perCall: 0.004 }, // $4 per 1M chars standard
  "google-tts-chirp3": { input: 0, output: 0, perCall: 0.016 }, // $16 per 1M chars for Chirp3
  
  // ─── Default fallback ───
  "default": { input: 0.10, output: 0.40 },
};

/**
 * Calculate cost based on tokens and model pricing
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  inputText?: string
): number {
  // Normalize model name (lowercase, trim)
  const normalizedModel = model.toLowerCase().trim();
  
  // Find pricing - try exact match first, then partial match
  let pricing = MODEL_PRICING[normalizedModel];
  
  if (!pricing) {
    // Try partial match
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
  
  // If perCall pricing exists, use that
  if (pricing.perCall && pricing.perCall > 0) {
    // For TTS, estimate based on character count
    if (normalizedModel.includes("tts") && inputText) {
      const charCount = inputText.length;
      return (charCount / 1000) * pricing.perCall;
    }
    return pricing.perCall;
  }
  
  // Token-based pricing
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Logger Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log AI usage to the ai_logs table
 * This function is designed to be fire-and-forget - it won't throw errors
 */
export async function logAI(params: AILogParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[aiLogger] Missing Supabase credentials, skipping log");
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Calculate tokens if not provided
    const inputTokens = params.inputTokens ?? estimateTokens(params.inputText);
    const outputTokens = params.outputTokens ?? estimateTokens(params.outputText);
    
    // Calculate cost
    const cost = calculateCost(params.model, inputTokens, outputTokens, params.inputText);
    
    // Call the RPC function with CORRECT parameter names matching the DB function signature
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
      console.log(`[aiLogger] ✅ Logged: ${params.functionName} | ${params.provider}/${params.model} | ${inputTokens}+${outputTokens} tokens | $${cost.toFixed(6)}`);
    }
  } catch (err) {
    // Never throw - logging should not break the main function
    console.error("[aiLogger] Error logging AI usage:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience wrapper for quick logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick log helper for simple cases
 */
export async function logAISimple(
  functionName: string,
  provider: string,
  model: string,
  status: "success" | "error",
  userId?: string,
  durationMs?: number
): Promise<void> {
  await logAI({
    functionName,
    provider,
    model,
    status,
    userId,
    durationMs,
  });
}
