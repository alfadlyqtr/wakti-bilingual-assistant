import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const rawBody = await req.text();
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = parsed?.data ?? parsed ?? {};
    const taskId = (payload?.taskId || payload?.task_id || "").toString();
    const status = (payload?.status || "").toString().toLowerCase();
    const errorMessage = (payload?.errorMessage || parsed?.msg || "").toString();

    if (!taskId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row } = await supabaseService
      .from("user_music_voices")
      .select("id, generation_task_id, validate_task_id, status")
      .or(`validate_task_id.eq.${taskId},generation_task_id.eq.${taskId}`)
      .limit(1)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.validate_task_id === taskId) {
      if ((status === "wait_validating" || status === "success") && payload?.validateInfo) {
        await supabaseService
          .from("user_music_voices")
          .update({
            validate_phrase: payload.validateInfo,
            status: "phrase_ready",
            status_detail: payload.status || "wait_validating",
            error_message: null,
          })
          .eq("id", row.id);
      } else if (status === "processing_validate_fail" || status === "fail") {
        await supabaseService
          .from("user_music_voices")
          .update({
            status: "failed",
            status_detail: payload.status || "fail",
            error_message: errorMessage || "Phrase generation failed",
          })
          .eq("id", row.id);
      }
    }

    if (row.generation_task_id === taskId) {
      if (status === "success" && payload?.voiceId) {
        let isAvailable = false;
        if (KIE_API_KEY) {
          try {
            const availabilityResp = await fetch("https://api.kie.ai/api/v1/voice/check-voice", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${KIE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ task_id: taskId }),
            });
            const availabilityText = await availabilityResp.text();
            if (availabilityResp.ok) {
              const availabilityData = JSON.parse(availabilityText);
              isAvailable = Boolean(availabilityData?.data?.isAvailable);
            }
          } catch (availabilityError) {
            console.error("[music-voice-callback] availability check failed:", availabilityError);
          }
        }

        await supabaseService
          .from("user_music_voices")
          .update({
            kie_voice_id: payload.voiceId,
            status: isAvailable ? "ready" : "voice_pending",
            status_detail: payload.status || "success",
            is_available: isAvailable,
            availability_checked_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", row.id);
      } else if (status === "processing_validate_fail" || status === "fail") {
        await supabaseService
          .from("user_music_voices")
          .update({
            status: "failed",
            status_detail: payload.status || "fail",
            error_message: errorMessage || "Voice generation failed",
          })
          .eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[music-voice-callback] Error:", (error as Error).message);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
