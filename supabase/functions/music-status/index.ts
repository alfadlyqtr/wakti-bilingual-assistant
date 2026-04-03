import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

interface SunoTrack {
  id: string;
  audioUrl?: string;
  audio_url?: string;
  sourceAudioUrl?: string;
  imageUrl?: string;
  image_url?: string;
  prompt?: string;
  modelName?: string;
  model_name?: string;
  title?: string;
  tags?: string;
  createTime?: number | string;
  duration?: number;
}

function normalizeTrack(track: SunoTrack) {
  return {
    id: track.id,
    audioUrl: track.audioUrl || track.audio_url || "",
    imageUrl: track.imageUrl || track.image_url,
    prompt: track.prompt,
    modelName: track.modelName || track.model_name,
    title: track.title,
    tags: track.tags,
    createTime: track.createTime,
    duration: track.duration,
  };
}

// deno-lint-ignore no-explicit-any
async function downloadAndStore(
  supabaseService: any,
  url: string,
  storageBucket: string,
  filePath: string,
  contentType: string
): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const blob = new Blob([buffer], { type: contentType });

    const { error: uploadError } = await supabaseService.storage
      .from(storageBucket)
      .upload(filePath, blob, { contentType, upsert: true });

    if (uploadError) {
      console.error(`[music-status] Upload error:`, uploadError);
      return null;
    }

    const { data: urlData } = supabaseService.storage
      .from(storageBucket)
      .getPublicUrl(filePath);

    return urlData?.publicUrl ?? null;
  } catch {
    return null;
  }
}

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
    const taskId = (body?.taskId || "").toString().trim();
    const recordId = (body?.recordId || "").toString().trim();

    if (!taskId) throw new Error("Missing taskId");

    // First check DB — if callback already fired, return completed state
    const { data: dbRows } = await supabaseService
      .from("user_music_tracks")
      .select("id, user_id, signed_url, cover_url, duration, title, prompt, meta, variant_index, storage_path, include_styles, requested_duration_seconds, model")
      .eq("task_id", taskId)
      .order("variant_index", { ascending: true });

    const completedRows = (dbRows ?? []).filter(
      (r: any) => r.meta?.status === "completed" && r.signed_url
    );
    const totalRows = (dbRows ?? []).length;

    // Only return completed if ALL rows for this task are done
    // (KIE generates 2 variants — wait for both before resolving)
    if (completedRows.length > 0 && completedRows.length >= totalRows && totalRows > 0) {
      return new Response(JSON.stringify({
        status: "completed",
        tracks: completedRows.map((r: any) => ({
          id: r.id,
          audioUrl: r.signed_url,
          coverUrl: r.cover_url,
          duration: r.duration,
          title: r.title,
          variantIndex: r.variant_index ?? 0,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if marked as failed
    const failedRow = (dbRows ?? []).find((r: any) => r.meta?.status === "failed");
    if (failedRow) {
      return new Response(JSON.stringify({
        status: "failed",
        error: failedRow.meta?.error || "Generation failed",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Poll KIE.ai directly
    const kieResp = await fetch(
      `https://api.kie.ai/api/v1/music/detail?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
      }
    );

    if (!kieResp.ok) {
      const errText = await kieResp.text();
      throw new Error(`KIE.ai poll error: ${kieResp.status} ${errText}`);
    }

    const kieData = await kieResp.json();
    const rawStatus = (
      kieData?.data?.status ??
      kieData?.data?.musicStatus ??
      kieData?.data?.callbackType ??
      ""
    ).toString();
    const kieStatus = rawStatus.toLowerCase();
    const sunoData: SunoTrack[] = kieData?.data?.data ?? kieData?.data?.response?.sunoData ?? kieData?.data?.sunoData ?? [];
    const normalizedTracks = sunoData.map(normalizeTrack).filter((track) => track.audioUrl);

    if ((kieStatus === "success" || kieStatus === "complete" || kieStatus === "completed") && normalizedTracks.length > 0) {
      // Grab placeholder row metadata
      const placeholderRow = (dbRows ?? []).find((r: any) => r.id === recordId) ?? (dbRows ?? [])[0];

      if (!placeholderRow) {
        return new Response(JSON.stringify({ status: "generating" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timestamp = Date.now();
      const savedTracks: Array<{ id: string; audioUrl: string; coverUrl: string | null; duration: number | null; title: string | null; variantIndex: number }> = [];

      for (let i = 0; i < normalizedTracks.length; i++) {
        const track = normalizedTracks[i];
        const isFirst = i === 0;

        const audioFileName = `${user.id}/${timestamp}_${taskId.slice(0, 8)}_v${i}.mp3`;
        const publicAudioUrl = await downloadAndStore(supabaseService, track.audioUrl, "music", audioFileName, "audio/mpeg");

        let publicCoverUrl: string | null = null;
        if (track.imageUrl) {
          const coverFileName = `${user.id}/${timestamp}_${taskId.slice(0, 8)}_v${i}.jpeg`;
          publicCoverUrl = await downloadAndStore(supabaseService, track.imageUrl, "music-covers", coverFileName, "image/jpeg");
        }

        const trackMeta = {
          ...(placeholderRow.meta as Record<string, unknown> ?? {}),
          status: "completed",
          saved: true,
          kie_track_id: track.id,
          model_name: track.modelName,
          tags: track.tags,
        };

        let savedRowId = placeholderRow.id;

        if (isFirst) {
          await supabaseService
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
              meta: trackMeta,
            })
            .eq("id", placeholderRow.id);
        } else {
          const { data: insertedRows } = await supabaseService
            .from("user_music_tracks")
            .insert({
              user_id: user.id,
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
              meta: trackMeta,
            })
            .select("id")
            .single();
          if (insertedRows?.id) savedRowId = insertedRows.id;
        }

        savedTracks.push({
          id: savedRowId,
          audioUrl: publicAudioUrl ?? track.audioUrl,
          coverUrl: publicCoverUrl,
          duration: track.duration ?? null,
          title: track.title || null,
          variantIndex: i,
        });
      }

      return new Response(JSON.stringify({ status: "completed", tracks: savedTracks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (kieStatus === "failed" || kieStatus === "error") {
      if (recordId) {
        const failureMessage = kieData?.data?.errorMessage || kieData?.data?.error_message || kieData?.msg || "Failed";
        await supabaseService
          .from("user_music_tracks")
          .update({ meta: { status: "failed", error: failureMessage } })
          .eq("id", recordId);
      }
      return new Response(JSON.stringify({ status: "failed", error: kieData?.data?.errorMessage || kieData?.data?.error_message || kieData?.msg || "Generation failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Still generating
    return new Response(JSON.stringify({ status: "generating" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[music-status] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
