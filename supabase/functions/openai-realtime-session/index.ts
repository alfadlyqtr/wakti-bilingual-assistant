import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ALLOWED_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "mann", "marin", "cedar"]);
const ALLOWED_MODELS = new Set(["gpt-realtime-2", "gpt-realtime"]);
const DEFAULT_MODEL_CANDIDATES = ["gpt-realtime-2", "gpt-realtime"];
const ALLOWED_TRANSCRIPTION_MODELS = new Set(["gpt-4o-transcribe", "gpt-realtime-whisper"]);
const DEFAULT_TRANSCRIPTION_CANDIDATES = ["gpt-4o-transcribe", "gpt-realtime-whisper"];
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header", stage: "auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", stage: "auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const requestedVoice = typeof body?.voice === "string" ? body.voice.trim() : "";
    const realtimeVoice = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : "shimmer";
    const requestedModelRaw = typeof body?.model === "string" ? body.model.trim() : "";
    const requestedModel = ALLOWED_MODELS.has(requestedModelRaw) ? requestedModelRaw : "";
    const requestedTranscriptionRaw = typeof body?.transcription_model === "string" ? body.transcription_model.trim() : "";
    const requestedTranscriptionModel = ALLOWED_TRANSCRIPTION_MODELS.has(requestedTranscriptionRaw)
      ? requestedTranscriptionRaw
      : "";
    const transcriptionLanguage = body?.language === "ar" ? "ar" : "en";
    const transcriptionPrompt = transcriptionLanguage === "ar"
      ? "Transcribe the speaker in Arabic only. Do not translate into another language. If the audio is unclear, wait for clearer speech rather than guessing a different language."
      : "Transcribe the speaker in English only. Do not translate into another language. If the audio is unclear, wait for clearer speech rather than guessing Chinese, Dutch, Irish, or another language.";
    const modelCandidates = uniqueNonEmpty([
      requestedModel,
      ...DEFAULT_MODEL_CANDIDATES,
    ]);
    const transcriptionCandidates = uniqueNonEmpty([
      requestedTranscriptionModel,
      ...DEFAULT_TRANSCRIPTION_CANDIDATES,
    ]);
    const { sdp_offer } = body;

    if (!sdp_offer) {
      return new Response(JSON.stringify({ error: "Missing sdp_offer", stage: "request_validation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[openai-realtime-session] Creating session using realtime/calls endpoint...");
    console.log("[openai-realtime-session] Model candidates:", modelCandidates.join(", "));
    console.log("[openai-realtime-session] Transcription candidates:", transcriptionCandidates.join(", "));
    console.log("[openai-realtime-session] Voice:", realtimeVoice);
    let lastStatus = 500;
    let lastErrorText = "Unknown realtime session error";
    const attempted: string[] = [];

    for (const model of modelCandidates) {
      for (const transcriptionModel of transcriptionCandidates) {
        attempted.push(`${model} / ${transcriptionModel}`);

        const sessionConfig = JSON.stringify({
          type: "realtime",
          model,
          audio: {
            input: {
              transcription: {
                model: transcriptionModel,
                language: transcriptionLanguage,
                prompt: transcriptionPrompt,
                delay: "medium",
              },
              noise_reduction: { type: "near_field" },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "low",
                create_response: false,
                interrupt_response: false,
              },
            },
            output: { voice: realtimeVoice },
          },
        });

        const formData = new FormData();
        formData.set("sdp", sdp_offer);
        formData.set("session", sessionConfig);

        const openaiResponse = await fetch(REALTIME_CALLS_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (openaiResponse.ok) {
          const sdpAnswer = await openaiResponse.text();
          console.log("[openai-realtime-session] Session created with:", `${model} / ${transcriptionModel}`);
          console.log("[openai-realtime-session] Got SDP answer, length:", sdpAnswer.length);

          return new Response(JSON.stringify({
            success: true,
            sdp_answer: sdpAnswer,
            model,
            transcription_model: transcriptionModel,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        lastStatus = openaiResponse.status;
        lastErrorText = await openaiResponse.text();
        console.warn(
          "[openai-realtime-session] Candidate failed:",
          `${model} / ${transcriptionModel}`,
          "status:",
          openaiResponse.status,
          "details:",
          lastErrorText,
        );
      }
    }

    console.error("[openai-realtime-session] All candidates failed:", attempted.join(" | "));
    return new Response(JSON.stringify({
      error: "Failed to create realtime session",
      stage: "openai_sdp_exchange",
      details: lastErrorText,
      attempted,
    }), {
      status: lastStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[openai-realtime-session] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", stage: "server_exception", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
