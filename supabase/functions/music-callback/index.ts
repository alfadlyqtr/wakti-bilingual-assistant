import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAndConsumeTrialTokenOnce } from "../_shared/trial-tracker.ts";
import { finalizeMusicTaskTracks } from "../_shared/music-finalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// env vars moved inside handler — do NOT read at module level in Deno edge functions

interface SunoTrack {
  id: string;
  audioUrl?: string;
  audio_url?: string;
  sourceAudioUrl?: string;
  streamAudioUrl?: string;
  stream_audio_url?: string;
  imageUrl?: string;
  image_url?: string;
  sourceImageUrl?: string;
  prompt?: string;
  modelName?: string;
  model_name?: string;
  title?: string;
  tags?: string;
  createTime?: number | string;
  duration?: number;
}

interface KieCallbackPayload {
  taskId?: string;
  task_id?: string;
  parentMusicId?: string;
  param?: string;
  response?: {
    taskId?: string;
    sunoData?: SunoTrack[];
  };
  status?: string;
  type?: string;
  callbackType?: string;
  operationType?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createTime?: number;
  data?: SunoTrack[];
}

function normalizeTrack(track: SunoTrack) {
  return {
    id: track.id,
    audioUrl: track.audioUrl || track.audio_url || "",
    streamAudioUrl: track.streamAudioUrl || track.stream_audio_url,
    imageUrl: track.imageUrl || track.image_url,
    prompt: track.prompt,
    modelName: track.modelName || track.model_name,
    title: track.title,
    tags: track.tags,
    createTime: track.createTime,
    duration: track.duration,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[music-callback] Missing env vars");
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const rawBody = await req.text();
    console.log("[music-callback] RAW BODY:", rawBody.slice(0, 600));

    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch {
      console.error("[music-callback] JSON parse failed");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // KIE wraps payload in { code, msg, data: {...} } OR sends directly
    const payload: KieCallbackPayload = parsed.data ?? parsed;

    const taskId = payload.taskId || payload.task_id || payload.response?.taskId;
    const status = ((parsed.status || payload.status || "") as string).toUpperCase();
    const type = ((payload.callbackType || payload.type || "") as string).toLowerCase();

    console.log(`[music-callback] taskId=${taskId}, status=${status}, type=${type}`);

    if (!taskId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always acknowledge quickly — KIE.ai expects a fast 200
    // We process async after this point

    // KIE docs: callbackType = text | first | complete, wrapped in parsed.data
    const isDone = type === "complete" || status === "SUCCESS" || status === "COMPLETE";

    if (isDone) {
      const sunoData: SunoTrack[] = payload.data ?? payload.response?.sunoData ?? [];
      const normalizedTracks = sunoData.map(normalizeTrack).filter((track) => track.audioUrl);

      if (normalizedTracks.length === 0) {
        console.warn(`[music-callback] SUCCESS but no sunoData for taskId=${taskId}`);
        await supabaseService
          .from("user_music_tracks")
          .update({ meta: { status: "failed", error: "No audio data returned" } })
          .eq("task_id", taskId)
          .eq("meta->>status", "generating");

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the placeholder row (status=generating) for this taskId
      const { data: existingRows, error: fetchError } = await supabaseService
        .from("user_music_tracks")
        .select("id, user_id, task_id, meta, title, prompt, include_styles, requested_duration_seconds, model")
        .eq("task_id", taskId)
        .limit(1);

      if (fetchError || !existingRows || existingRows.length === 0) {
        console.error(`[music-callback] No placeholder row found for taskId=${taskId}`, fetchError);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const placeholderRow = existingRows[0];
      const userId = placeholderRow.user_id;
      const timestamp = Date.now();
      const consumeTrial = await checkAndConsumeTrialTokenOnce(supabaseService, userId, 'music', 1, taskId);
      if (!consumeTrial.allowed) {
        console.warn('[music-callback] Trial consume skipped after success:', consumeTrial.reason);
      }

      await finalizeMusicTaskTracks({
        supabaseService,
        placeholderRow,
        taskId,
        userId,
        normalizedTracks,
        timestamp,
      });

    } else if (status === "FAILED" || status === "ERROR" || type === "failed") {
      const failureMessage = payload.errorMessage || payload.errorCode || parsed?.msg || "Generation failed";
      console.error(`[music-callback] Task failed taskId=${taskId}:`, failureMessage);

      await supabaseService
        .from("user_music_tracks")
        .update({
          meta: {
            status: "failed",
            error: failureMessage,
          },
        })
        .eq("task_id", taskId);

    } else if (type === "first") {
      // "first" callback: low-bitrate preview is ready — save URL but keep status=generating
      // The Realtime listener on the frontend only triggers on status='completed'
      // so users will never see the low-quality preview, only the final high-bitrate render
      const previewTracks: SunoTrack[] = payload.data ?? payload.response?.sunoData ?? [];
      const firstPreview = previewTracks[0];
      if (firstPreview?.audioUrl || firstPreview?.audio_url) {
        const previewUrl = firstPreview.audioUrl || firstPreview.audio_url || "";
        console.log(`[music-callback] "first" preview ready for taskId=${taskId}, saving URL but keeping status=generating`);
        await supabaseService
          .from("user_music_tracks")
          .update({ source_audio_url: previewUrl })
          .eq("task_id", taskId)
          .eq("meta->>status", "generating");
      } else {
        console.log(`[music-callback] "first" callback received, no preview URL, taskId=${taskId}`);
      }
    } else {
      // Other intermediate stages: text, etc. — just log
      console.log(`[music-callback] Intermediate stage status=${status} type=${type} for taskId=${taskId}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[music-callback] Unhandled error:", (error as Error).message);
    // Always return 200 to KIE.ai so it doesn't retry endlessly
    return new Response(JSON.stringify({ ok: true, warning: "Internal error logged" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
