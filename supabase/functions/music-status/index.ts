import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTrialSuccessPayload, checkAndConsumeTrialTokenOnce } from "../_shared/trial-tracker.ts";
import { finalizeMusicTaskTracks } from "../_shared/music-finalize.ts";

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
    const { data: dbRows, error: dbError } = await supabaseService
      .from("user_music_tracks")
      .select("id, user_id, signed_url, cover_url, duration, title, prompt, meta, variant_index, storage_path, include_styles, requested_duration_seconds, model")
      .eq("task_id", taskId)
      .order("variant_index", { ascending: true });

    if (dbError) {
      console.error("[music-status] DB query error:", dbError);
    }

    // Safe meta accessor — meta is JSONB, may be null or any shape
    const getMetaStatus = (r: any): string => {
      try {
        const m = r?.meta;
        if (!m || typeof m !== "object") return "generating";
        return (m.status ?? "generating").toString();
      } catch { return "generating"; }
    };
    const getMetaError = (r: any): string => {
      try {
        const m = r?.meta;
        if (!m || typeof m !== "object") return "Generation failed";
        return (m.error ?? "Generation failed").toString();
      } catch { return "Generation failed"; }
    };

    const completedRows = (dbRows ?? []).filter(
      (r: any) => getMetaStatus(r) === "completed" && r.signed_url
    );
    const totalRows = (dbRows ?? []).length;

    const getMusicTrialPayload = async () => {
      const consumeTrial = await checkAndConsumeTrialTokenOnce(supabaseService, user.id, 'music', 1, taskId);
      if (!consumeTrial.allowed) {
        console.warn('[music-status] Trial consume skipped after success:', consumeTrial.reason);
        return null;
      }
      return buildTrialSuccessPayload('music', consumeTrial);
    };

    // Return completed from DB if we have 2+ variants done
    if (completedRows.length >= 2 && totalRows >= 2) {
      const trial = await getMusicTrialPayload();
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
        trial,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if marked as failed
    const failedRow = (dbRows ?? []).find((r: any) => getMetaStatus(r) === "failed");
    if (failedRow) {
      return new Response(JSON.stringify({
        status: "failed",
        error: getMetaError(failedRow),
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
      const savedTracks = await finalizeMusicTaskTracks({
        supabaseService,
        placeholderRow,
        taskId,
        userId: user.id,
        normalizedTracks,
        timestamp,
      });

      const trial = await getMusicTrialPayload();
      return new Response(JSON.stringify({ status: "completed", tracks: savedTracks, trial }), {
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
