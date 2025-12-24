import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/**
 * presentation-elevenlabs-tts
 * 
 * Dedicated ElevenLabs TTS endpoint for Presentation narration ONLY.
 * Does NOT share quota/logic with Talk Back, Mini Speaker, or other voice features.
 * 
 * Voice IDs (Eleven Multilingual v2):
 *   Male Arabic:   G1QUjBCuRBbLbAmYlTgl
 *   Male English:  uju3wxzG5OhpWcoi3SMy
 *   Female Arabic: u0TsaWvt0v8migutHM3M
 *   Female English: gh8WokH7VR2QkmMmwWHS
 * 
 * Settings (locked):
 *   stability: 1.0
 *   similarity_boost: 1.0
 *   style: 0.50
 *   use_speaker_boost: true
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Voice ID mapping: language + gender -> ElevenLabs voice_id
const VOICE_MAP: Record<string, string> = {
  'ar_male': 'G1QUjBCuRBbLbAmYlTgl',
  'ar_female': 'u0TsaWvt0v8migutHM3M',
  'en_male': 'uju3wxzG5OhpWcoi3SMy',
  'en_female': 'gh8WokH7VR2QkmMmwWHS',
};

// Locked voice settings for presentations
const VOICE_SETTINGS = {
  stability: 1.0,
  similarity_boost: 1.0,
  style: 0.50,
  use_speaker_boost: true,
};

// ElevenLabs model
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

console.log("🎤 PRESENTATION-ELEVENLABS-TTS: Function loaded");
console.log("🎤 ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

/**
 * Fast user ID extraction from JWT token (no network call).
 */
function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = atob(base64);
    const payload = JSON.parse(payloadJson);
    const userId = payload.sub;
    if (typeof userId === "string" && userId.length > 0) return userId;
    return null;
  } catch {
    return null;
  }
}

/**
 * Estimate token count from text
 */
function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Log AI usage to the ai_logs table
 */
async function logAI(params: {
  functionName: string;
  userId?: string;
  provider: string;
  model: string;
  inputText?: string;
  outputText?: string;
  durationMs?: number;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const inputTokens = estimateTokens(params.inputText);
    const outputTokens = estimateTokens(params.outputText);
    // ElevenLabs cost: $0.30 per 1K chars = $0.0003 per char
    const cost = params.inputText ? params.inputText.length * 0.0003 : 0;
    
    const { error } = await supabaseService.rpc("log_ai_usage", {
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
      console.log(`[aiLogger] ✅ Logged: ${params.functionName} | ${params.provider}/${params.model} | $${cost.toFixed(6)}`);
    }
  } catch (err) {
    console.error("[aiLogger] Error logging AI usage:", err);
  }
}

/**
 * Detect if text is predominantly Arabic
 */
function isArabicText(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const matches = text.match(arabicPattern) || [];
  return matches.length / text.length > 0.3;
}

/**
 * Resolve voice_id from language + gender, or use explicit voice_id if provided
 */
function resolveVoiceId(params: { voice_id?: string; language?: string; gender?: string; text?: string }): string {
  if (params.voice_id && Object.values(VOICE_MAP).includes(params.voice_id)) {
    return params.voice_id;
  }
  let lang: 'ar' | 'en' = 'en';
  if (params.language) {
    lang = params.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } else if (params.text) {
    lang = isArabicText(params.text) ? 'ar' : 'en';
  }
  const gender = (params.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const key = `${lang}_${gender}`;
  return VOICE_MAP[key] || VOICE_MAP['en_male'];
}

serve(async (req: Request) => {
  console.log(`🎤 Request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎤 Authenticated user: ${user.id}`);

    // Validate ElevenLabs API key
    if (!ELEVENLABS_API_KEY) {
      console.error('🎤 ELEVENLABS_API_KEY not configured');
      throw new Error('ElevenLabs API key not configured');
    }

    // Parse request body
    const body = await req.json();
    const { text, voice_id, language, gender } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Missing or empty text field');
    }

    const trimmedText = text.trim();
    const resolvedVoiceId = resolveVoiceId({ voice_id, language, gender, text: trimmedText });

    console.log(`🎤 TTS request:`, {
      textLength: trimmedText.length,
      textPreview: trimmedText.substring(0, 80),
      resolvedVoiceId,
      language: language || 'auto',
      gender: gender || 'male',
    });

    // Call ElevenLabs TTS API
    const startTime = Date.now();
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`;

    const ttsResponse = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: ELEVENLABS_MODEL,
        voice_settings: VOICE_SETTINGS,
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('🎤 ElevenLabs API error:', ttsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errorText.slice(0, 500)}`);
    }

    // Get audio bytes
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const durationMs = Date.now() - startTime;

    console.log(`🎤 TTS success:`, {
      audioSize: audioBytes.byteLength,
      durationMs,
      voiceId: resolvedVoiceId,
    });

    // Log AI usage
    const userId = getUserIdFromRequest(req) ?? undefined;
    await logAI({
      functionName: "presentation-elevenlabs-tts",
      userId,
      provider: "elevenlabs",
      model: "elevenlabs-tts",
      inputText: trimmedText,
      durationMs,
      status: "success",
      metadata: {
        voiceId: resolvedVoiceId,
        audioSize: audioBytes.byteLength,
        textLength: trimmedText.length,
      },
    });

    // Return audio as binary response
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBytes.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error: unknown) {
    const message = (error && typeof error === 'object' && 'message' in error)
      ? (error as { message: string }).message
      : 'Presentation TTS generation failed';

    console.error('🎤 TTS error:', error);

    // Log failed AI usage
    const errorUserId = getUserIdFromRequest(req) ?? undefined;
    await logAI({
      functionName: "presentation-elevenlabs-tts",
      userId: errorUserId,
      provider: "elevenlabs",
      model: "elevenlabs-tts",
      status: "error",
      errorMessage: message,
    });

    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
