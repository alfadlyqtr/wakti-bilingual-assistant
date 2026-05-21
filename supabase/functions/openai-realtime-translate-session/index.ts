import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTrialErrorPayload, buildTrialSuccessPayload, checkAndConsumeTrialTokenOnce, checkTrialAccess } from "../_shared/trial-tracker.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MODEL = "gpt-realtime-2";
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const FRIENDLY_CONNECTION_ERROR = "Live Translator is not available right now. Please try again.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trial gate: interpreter — limit 5 for free users
    const trial = await checkTrialAccess(supabase, user.id, 'interpreter', 5);
    if (!trial.allowed) {
      return new Response(JSON.stringify(buildTrialErrorPayload('interpreter', trial)), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { sdp_offer, voice } = body;
    // cedar = Male (ash), marin = Female (shimmer)
    const resolvedVoice = voice === 'cedar' ? 'ash' : voice === 'marin' ? 'shimmer' : 'ash';

    if (!sdp_offer) {
      return new Response(JSON.stringify({ error: "Missing sdp_offer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[openai-realtime-translate-session] Creating session using GA unified interface...");
    console.log("[openai-realtime-translate-session] Model:", MODEL);

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: MODEL,
      audio: {
        input: {
          transcription: { model: "gpt-realtime-whisper" },
        },
        output: { voice: resolvedVoice },
      },
    });

    const formData = new FormData();
    formData.set("sdp", sdp_offer);
    formData.set("session", sessionConfig);

    // Call OpenAI Realtime API with multipart form (unified GA interface)
    const openaiResponse = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[openai-realtime-translate-session] OpenAI error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({
        error: "LIVE_TRANSLATOR_UNAVAILABLE",
        message: FRIENDLY_CONNECTION_ERROR,
        details: FRIENDLY_CONNECTION_ERROR,
      }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sdpAnswer = await openaiResponse.text();
    const consumeTrial = await checkAndConsumeTrialTokenOnce(supabase, user.id, 'interpreter', 5, sdpAnswer);
    const trialPayload = consumeTrial.allowed
      ? buildTrialSuccessPayload('interpreter', consumeTrial)
      : null;
    if (!consumeTrial.allowed) {
      console.warn('[openai-realtime-translate-session] Trial consume skipped after success:', consumeTrial.reason);
    }

    return new Response(JSON.stringify({
      success: true,
      sdp_answer: sdpAnswer,
      model: MODEL,
      trial: trialPayload,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[openai-realtime-translate-session] Error:", err);
    return new Response(JSON.stringify({
      error: "LIVE_TRANSLATOR_UNAVAILABLE",
      message: FRIENDLY_CONNECTION_ERROR,
      details: FRIENDLY_CONNECTION_ERROR,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
