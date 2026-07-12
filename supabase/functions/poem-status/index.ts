import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ═══════════════════════════════════════════════════════════════════════════
// Poem Reader status — frontend polling fallback in case a webhook is missed.
// Mirrors music-status's dual-path pattern (DB-first, then poll KIE directly).
// Speech (ElevenLabs) and instrumental (Suno) each have their own KIE query
// endpoint, polled independently.
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Authentication failed");

    const body = await req.json();
    const trackId = (body?.trackId || "").toString().trim();
    if (!trackId) throw new Error("Missing trackId");

    const { data: row, error: fetchError } = await supabaseService
      .from("user_poem_tracks")
      .select("*")
      .eq("id", trackId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !row) throw new Error("Poem track not found");

    // Already terminal — nothing to poll.
    if (row.status === "ready" || row.status === "failed" || row.status === "mixing") {
      return respond(row);
    }

    let speechStatus = row.speech_status;
    let speechAudioUrl = row.speech_audio_url;
    let instrumentalStatus = row.instrumental_status;
    let instrumentalAudioUrl = row.instrumental_audio_url;
    let errorMessage = row.error_message;

    if (speechStatus === "processing" && row.speech_task_id) {
      const result = await pollSpeechTask(KIE_API_KEY, row.speech_task_id);
      if (result.status === "ready") {
        speechStatus = "ready";
        speechAudioUrl = result.audioUrl;
      } else if (result.status === "failed") {
        speechStatus = "failed";
        errorMessage = result.error || "Voice generation failed";
      }
    }

    if (instrumentalStatus === "processing" && row.instrumental_task_id) {
      const result = await pollInstrumentalTask(KIE_API_KEY, row.instrumental_task_id);
      if (result.status === "ready") {
        instrumentalStatus = "ready";
        instrumentalAudioUrl = result.audioUrl;
      } else if (result.status === "failed") {
        instrumentalStatus = "failed";
      }
    }

    const instrumentalTerminal = ["ready", "skipped", "failed"].includes(instrumentalStatus);
    let overallStatus = row.status;
    if (speechStatus === "failed") {
      overallStatus = "failed";
    } else if (speechStatus === "ready" && instrumentalTerminal) {
      overallStatus = "mixing";
    }

    if (
      speechStatus !== row.speech_status ||
      instrumentalStatus !== row.instrumental_status ||
      overallStatus !== row.status
    ) {
      await supabaseService
        .from("user_poem_tracks")
        .update({
          speech_status: speechStatus,
          speech_audio_url: speechAudioUrl,
          instrumental_status: instrumentalStatus,
          instrumental_audio_url: instrumentalAudioUrl,
          status: overallStatus,
          error_message: errorMessage,
        })
        .eq("id", trackId);
    }

    return respond({
      ...row,
      speech_status: speechStatus,
      speech_audio_url: speechAudioUrl,
      instrumental_status: instrumentalStatus,
      instrumental_audio_url: instrumentalAudioUrl,
      status: overallStatus,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error("[poem-status] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
function respond(row: any) {
  return new Response(
    JSON.stringify({
      id: row.id,
      status: row.status,
      speechStatus: row.speech_status,
      speechAudioUrl: row.speech_audio_url,
      instrumentalStatus: row.instrumental_status,
      instrumentalAudioUrl: row.instrumental_audio_url,
      finalAudioUrl: row.final_audio_url,
      title: row.title,
      language: row.language,
      error: row.error_message,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function pollSpeechTask(apiKey: string, taskId: string): Promise<{ status: "processing" | "ready" | "failed"; audioUrl?: string; error?: string }> {
  const resp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) return { status: "processing" };

  const data = await resp.json();
  const state = (data?.data?.state || "").toString().toLowerCase();

  if (state === "success") {
    try {
      const parsedResult = typeof data.data.resultJson === "string" ? JSON.parse(data.data.resultJson) : data.data.resultJson;
      const audioUrl = Array.isArray(parsedResult?.resultUrls) ? parsedResult.resultUrls[0] : undefined;
      if (audioUrl) return { status: "ready", audioUrl };
      return { status: "failed", error: "No audio returned for voice" };
    } catch {
      return { status: "failed", error: "Could not read voice result" };
    }
  }

  if (state === "fail" || state === "failed" || state === "error") {
    return { status: "failed", error: data?.data?.failMsg || "Voice generation failed" };
  }

  return { status: "processing" };
}

async function pollInstrumentalTask(apiKey: string, taskId: string): Promise<{ status: "processing" | "ready" | "failed"; audioUrl?: string }> {
  const resp = await fetch(`https://api.kie.ai/api/v1/music/detail?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) return { status: "processing" };

  const data = await resp.json();
  const rawStatus = (data?.data?.status ?? data?.data?.musicStatus ?? data?.data?.callbackType ?? "").toString().toLowerCase();
  // deno-lint-ignore no-explicit-any
  const tracks: any[] = data?.data?.data ?? data?.data?.response?.sunoData ?? data?.data?.sunoData ?? [];
  const first = tracks[0];
  const audioUrl = first?.audioUrl || first?.audio_url;

  if ((rawStatus === "success" || rawStatus === "complete" || rawStatus === "completed") && audioUrl) {
    return { status: "ready", audioUrl };
  }
  if (rawStatus === "failed" || rawStatus === "error") {
    return { status: "failed" };
  }
  return { status: "processing" };
}
