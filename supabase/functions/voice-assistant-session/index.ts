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

    const body = await req.json();
    const { sdp_offer, timezone, local_now } = body;

    if (!sdp_offer) {
      return new Response(JSON.stringify({ error: "Missing sdp_offer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client-local context (optional): helps debugging and future context-aware behavior
    if (timezone || local_now) {
      console.log('[voice-assistant-session] Client context:', { timezone, local_now });
    }

    // Fetch user display name for greeting (never use email)
    let displayName = "";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, full_name")
        .eq("id", user.id)
        .single();
      
      // Try profiles table first, then user_metadata
      displayName = profile?.display_name || profile?.full_name || profile?.username || "";
      
      // Fallback to user_metadata if profiles didn't have a name
      if (!displayName && user.user_metadata) {
        displayName = user.user_metadata.full_name || user.user_metadata.display_name || user.user_metadata.name || "";
      }
      
      console.log("[voice-assistant-session] Profile data:", profile);
      console.log("[voice-assistant-session] User metadata:", user.user_metadata);
      console.log("[voice-assistant-session] Final displayName:", displayName);
    } catch (e) {
      console.error("[voice-assistant-session] Error fetching profile:", e);
    }

    console.log("[voice-assistant-session] Creating session for user:", user.id);

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
      console.error("[voice-assistant-session] OpenAI error:", openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to create realtime session", details: errorText }), {
        status: openaiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sdpAnswer = await openaiResponse.text();
    console.log("[voice-assistant-session] Got SDP answer, length:", sdpAnswer.length);

    return new Response(JSON.stringify({
      success: true,
      sdp_answer: sdpAnswer,
      model: MODEL,
      display_name: displayName,
      timezone: timezone || null,
      local_now: local_now || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[voice-assistant-session] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
