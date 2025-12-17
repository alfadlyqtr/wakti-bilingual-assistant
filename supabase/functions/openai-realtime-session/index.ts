import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MODEL = "gpt-realtime-mini-2025-12-15";
const REALTIME_URL = `https://api.openai.com/v1/realtime?model=${MODEL}`;

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

    // Build instructions based on language
    const instructions = language === "ar"
      ? `أنت مساعد Wakti الصوتي. أجب بإيجاز ووضوح. تحدث بالعربية الفصحى أو اللهجة حسب ما يستخدمه المستخدم. كن ودودًا ومفيدًا.`
      : `You are Wakti Voice Assistant. Answer concisely and clearly. Be friendly and helpful. Keep responses brief since this is voice conversation.`;

    // Call OpenAI Realtime API with SDP offer
    const openaiResponse = await fetch(REALTIME_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/sdp",
      },
      body: sdp_offer,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI Realtime error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to create realtime session", details: errorText }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sdpAnswer = await openaiResponse.text();

    // Return SDP answer and session config to client
    return new Response(JSON.stringify({
      success: true,
      sdp_answer: sdpAnswer,
      model: MODEL,
      instructions,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("openai-realtime-session error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
