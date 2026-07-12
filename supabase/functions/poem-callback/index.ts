import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ═══════════════════════════════════════════════════════════════════════════
// Poem Reader callback — receives KIE webhooks for TWO independent job types:
//   1. Speech (elevenlabs/text-to-speech-multilingual-v2, unified Jobs API)
//   2. Instrumental-only bed (Suno, only when a background style was picked)
// Which job a callback belongs to is resolved by matching taskId against our
// own DB columns — never by guessing from payload shape alone.
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
type AnyClient = any;

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[poem-callback] Missing env vars");
    return ok();
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const rawBody = await req.text();
    console.log("[poem-callback] RAW BODY:", rawBody.slice(0, 600));

    // deno-lint-ignore no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      console.error("[poem-callback] JSON parse failed");
      return ok();
    }

    const payload = parsed.data ?? parsed;
    const taskId: string | undefined = payload.taskId || payload.task_id;

    if (!taskId) {
      console.error("[poem-callback] Missing taskId in callback");
      return ok();
    }

    const { data: bySpeech } = await supabaseService
      .from("user_poem_tracks")
      .select("id")
      .eq("speech_task_id", taskId)
      .limit(1);

    if (bySpeech && bySpeech.length > 0) {
      await handleSpeechCallback(supabaseService, taskId, payload);
      return ok();
    }

    const { data: byInstrumental } = await supabaseService
      .from("user_poem_tracks")
      .select("id")
      .eq("instrumental_task_id", taskId)
      .limit(1);

    if (byInstrumental && byInstrumental.length > 0) {
      await handleInstrumentalCallback(supabaseService, taskId, payload, parsed);
      return ok();
    }

    console.warn(`[poem-callback] No poem track found for taskId=${taskId}`);
    return ok();
  } catch (error) {
    console.error("[poem-callback] Unhandled error:", (error as Error).message);
    return ok();
  }
});

// ── Job 1: ElevenLabs speech (unified KIE Jobs/Market API shape) ──
async function handleSpeechCallback(supabaseService: AnyClient, taskId: string, payload: AnyClient) {
  const state = (payload.state || "").toString().toLowerCase();

  if (state === "fail" || state === "failed" || state === "error") {
    const failMsg = payload.failMsg || payload.failCode || "Voice generation failed";
    console.error(`[poem-callback] Speech job failed taskId=${taskId}:`, failMsg);
    await supabaseService
      .from("user_poem_tracks")
      .update({ speech_status: "failed", status: "failed", error_message: String(failMsg) })
      .eq("speech_task_id", taskId);
    return;
  }

  if (state !== "success") {
    console.log(`[poem-callback] Speech job intermediate state=${state} taskId=${taskId}`);
    return;
  }

  let resultUrls: string[] = [];
  try {
    const parsedResult = typeof payload.resultJson === "string" ? JSON.parse(payload.resultJson) : payload.resultJson;
    resultUrls = Array.isArray(parsedResult?.resultUrls) ? parsedResult.resultUrls : [];
  } catch (parseError) {
    console.error("[poem-callback] Failed to parse resultJson for speech job:", parseError);
  }

  const audioUrl = resultUrls[0];
  if (!audioUrl) {
    console.error(`[poem-callback] Speech job success but no audio URL taskId=${taskId}`);
    await supabaseService
      .from("user_poem_tracks")
      .update({ speech_status: "failed", status: "failed", error_message: "No audio returned for voice" })
      .eq("speech_task_id", taskId);
    return;
  }

  const { data: rows } = await supabaseService
    .from("user_poem_tracks")
    .select("id, instrumental_status")
    .eq("speech_task_id", taskId)
    .limit(1);
  const row = rows?.[0];
  if (!row) return;

  const instrumentalTerminal = ["ready", "skipped", "failed"].includes(row.instrumental_status);

  await supabaseService
    .from("user_poem_tracks")
    .update({
      speech_status: "ready",
      speech_audio_url: audioUrl,
      status: instrumentalTerminal ? "mixing" : "processing",
    })
    .eq("id", row.id);
}

// ── Job 2: Suno instrumental-only bed (Suno-specific callback shape) ──
async function handleInstrumentalCallback(supabaseService: AnyClient, taskId: string, payload: AnyClient, parsed: AnyClient) {
  const status = ((parsed.status || payload.status || "") as string).toUpperCase();
  const type = ((payload.callbackType || payload.type || "") as string).toLowerCase();
  const isDone = type === "complete" || status === "SUCCESS" || status === "COMPLETE";
  const isFailed = status === "FAILED" || status === "ERROR" || type === "failed";

  if (isFailed) {
    console.error(`[poem-callback] Instrumental job failed taskId=${taskId}`);
    await markInstrumentalDone(supabaseService, taskId, "failed", null);
    return;
  }

  if (!isDone) {
    console.log(`[poem-callback] Instrumental job intermediate stage taskId=${taskId}`);
    return;
  }

  const tracks: AnyClient[] = payload.data ?? payload.response?.sunoData ?? [];
  const first = tracks[0];
  const audioUrl = first?.audioUrl || first?.audio_url;

  if (!audioUrl) {
    console.error(`[poem-callback] Instrumental job done but no audio URL taskId=${taskId}`);
    await markInstrumentalDone(supabaseService, taskId, "failed", null);
    return;
  }

  await markInstrumentalDone(supabaseService, taskId, "ready", audioUrl);
}

// Instrumental bed is a nice-to-have: if it fails, we still gracefully fall back
// to voice-only rather than failing the whole poem.
async function markInstrumentalDone(
  supabaseService: AnyClient,
  taskId: string,
  resultStatus: "ready" | "failed",
  audioUrl: string | null
) {
  const { data: rows } = await supabaseService
    .from("user_poem_tracks")
    .select("id, speech_status")
    .eq("instrumental_task_id", taskId)
    .limit(1);
  const row = rows?.[0];
  if (!row) return;

  const speechReady = row.speech_status === "ready";

  await supabaseService
    .from("user_poem_tracks")
    .update({
      instrumental_status: resultStatus,
      instrumental_audio_url: audioUrl,
      status: speechReady ? "mixing" : "processing",
    })
    .eq("id", row.id);
}
