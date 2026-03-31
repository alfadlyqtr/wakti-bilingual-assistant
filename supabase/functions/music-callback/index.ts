import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// env vars moved inside handler — do NOT read at module level in Deno edge functions

interface SunoTrack {
  id: string;
  audioUrl: string;
  sourceAudioUrl?: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  sourceImageUrl?: string;
  prompt?: string;
  modelName?: string;
  title?: string;
  tags?: string;
  createTime?: number;
  duration?: number;
}

interface KieCallbackPayload {
  taskId: string;
  parentMusicId?: string;
  param?: string;
  response?: {
    taskId?: string;
    sunoData?: SunoTrack[];
  };
  status?: string;
  type?: string;
  operationType?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createTime?: number;
}

// deno-lint-ignore no-explicit-any
async function downloadAndStore(
  svc: any,
  url: string,
  storageBucket: string,
  filePath: string,
  contentType: string
): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[music-callback] Failed to fetch ${url}: ${resp.status}`);
      return null;
    }
    const buffer = await resp.arrayBuffer();
    const blob = new Blob([buffer], { type: contentType });

    const { error: uploadError } = await svc.storage
      .from(storageBucket)
      .upload(filePath, blob, { contentType, upsert: true });

    if (uploadError) {
      console.error(`[music-callback] Upload error for ${filePath}:`, uploadError);
      return null;
    }

    const { data: urlData } = svc.storage
      .from(storageBucket)
      .getPublicUrl(filePath);

    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error(`[music-callback] downloadAndStore error:`, e);
    return null;
  }
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

    const taskId = payload.taskId;
    // KIE uses 'type' for stage (text/first/complete) AND 'status' (SUCCESS/FAILED)
    const status = (payload.status || "").toUpperCase();
    const type = (payload.type || "").toLowerCase();

    console.log(`[music-callback] taskId=${taskId}, status=${status}, type=${type}`);

    if (!taskId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always acknowledge quickly — KIE.ai expects a fast 200
    // We process async after this point

    // 'complete' is the final type stage; 'SUCCESS' is the status value
    const isDone = status === "SUCCESS" || status === "COMPLETE" || type === "complete";

    if (isDone) {
      const sunoData: SunoTrack[] = payload.response?.sunoData ?? [];

      if (sunoData.length === 0) {
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

      // Process each variation
      for (let i = 0; i < sunoData.length; i++) {
        const track = sunoData[i];
        const isFirst = i === 0;

        console.log(`[music-callback] Processing variant ${i} for taskId=${taskId}`);

        // Download audio to our bucket
        const audioFileName = `${userId}/${timestamp}_${taskId.slice(0, 8)}_v${i}.mp3`;
        const publicAudioUrl = await downloadAndStore(
          supabaseService,
          track.audioUrl,
          "music",
          audioFileName,
          "audio/mpeg"
        );

        // Download cover image to our bucket
        let publicCoverUrl: string | null = null;
        if (track.imageUrl) {
          const coverFileName = `${userId}/${timestamp}_${taskId.slice(0, 8)}_v${i}.jpeg`;
          publicCoverUrl = await downloadAndStore(
            supabaseService,
            track.imageUrl,
            "music-covers",
            coverFileName,
            "image/jpeg"
          );
        }

        if (isFirst) {
          // Update the original placeholder row for the first variant
          const { error: updateError } = await supabaseService
            .from("user_music_tracks")
            .update({
              storage_path: audioFileName,
              signed_url: publicAudioUrl,
              cover_url: publicCoverUrl,
              source_audio_url: track.audioUrl,
              duration: track.duration ?? null,
              title: track.title || placeholderRow.title || null,
              variant_index: 0,
              mime: "audio/mpeg",
              meta: {
                ...(placeholderRow.meta as Record<string, unknown> ?? {}),
                status: "completed",
                kie_track_id: track.id,
                model_name: track.modelName,
                tags: track.tags,
              },
            })
            .eq("id", placeholderRow.id);

          if (updateError) {
            console.error(`[music-callback] Failed to update placeholder row:`, updateError);
          } else {
            console.log(`[music-callback] Updated placeholder row id=${placeholderRow.id}`);
          }
        } else {
          // Insert a new row for additional variants
          const { error: insertError } = await supabaseService
            .from("user_music_tracks")
            .insert({
              user_id: userId,
              task_id: taskId,
              title: track.title || placeholderRow.title || null,
              prompt: track.prompt || placeholderRow.prompt || null,
              include_styles: placeholderRow.include_styles,
              requested_duration_seconds: placeholderRow.requested_duration_seconds,
              provider: "kie",
              model: placeholderRow.model,
              storage_path: audioFileName,
              signed_url: publicAudioUrl,
              cover_url: publicCoverUrl,
              source_audio_url: track.audioUrl,
              duration: track.duration ?? null,
              variant_index: i,
              mime: "audio/mpeg",
              meta: {
                ...(placeholderRow.meta as Record<string, unknown> ?? {}),
                status: "completed",
                kie_track_id: track.id,
                model_name: track.modelName,
                tags: track.tags,
              },
            });

          if (insertError) {
            console.error(`[music-callback] Failed to insert variant row ${i}:`, insertError);
          } else {
            console.log(`[music-callback] Inserted variant row ${i} for taskId=${taskId}`);
          }
        }
      }

    } else if (status === "FAILED" || status === "ERROR" || type === "failed") {
      console.error(`[music-callback] Task failed taskId=${taskId}:`, payload.errorMessage);

      await supabaseService
        .from("user_music_tracks")
        .update({
          meta: {
            status: "failed",
            error: payload.errorMessage || payload.errorCode || "Generation failed",
          },
        })
        .eq("task_id", taskId);

    } else {
      // Intermediate stages: text, first — just log
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
