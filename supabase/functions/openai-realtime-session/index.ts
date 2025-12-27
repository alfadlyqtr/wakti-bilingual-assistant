import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// OpenAI Realtime GA endpoint (unified interface)
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

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
    // Verify user is authenticated
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

    // Parse request body
    const body = await req.json();
    const { sdp_offer, language = "en" } = body;

    if (!sdp_offer) {
      return new Response(JSON.stringify({ error: "Missing sdp_offer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Session configuration for OpenAI Realtime (GA unified interface)
    // Using gpt-realtime model with voice output
    const sessionConfig = {
      type: "realtime",
      model: "gpt-realtime",
      audio: {
        output: {
          voice: "shimmer",
        },
      },
    };

    console.log("[openai-realtime-session] Creating session with unified interface...");
    console.log("[openai-realtime-session] Session config:", JSON.stringify(sessionConfig));

    // Build multipart form data as per OpenAI docs
    const formData = new FormData();
    formData.set("sdp", sdp_offer);
    formData.set("session", JSON.stringify(sessionConfig));

    // Call OpenAI Realtime API with multipart form (unified interface)
    const openaiResponse = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[openai-realtime-session] OpenAI error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to create realtime session", details: errorText }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OpenAI returns the SDP answer as plain text
    const sdpAnswer = await openaiResponse.text();
    console.log("[openai-realtime-session] Got SDP answer, length:", sdpAnswer.length);

    // Return SDP answer to client
    return new Response(JSON.stringify({
      success: true,
      sdp_answer: sdpAnswer,
      model: "gpt-realtime",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[openai-realtime-session] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
