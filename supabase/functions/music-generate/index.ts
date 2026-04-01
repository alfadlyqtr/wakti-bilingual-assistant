import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAndConsumeTrialToken } from "../_shared/trial-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

 interface SunoTrack {
   id: string;
   audioUrl: string;
   streamAudioUrl?: string;
   imageUrl?: string;
   prompt?: string;
   modelName?: string;
   title?: string;
   tags?: string;
   createTime?: string | number;
   duration?: number;
 }

function getModelLimits(model: string) {
  if (model === "V4") {
    return { prompt: 3000, style: 200 };
  }

  return { prompt: 5000, style: 1000 };
}

 function sleep(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
 }

 // deno-lint-ignore no-explicit-any
 async function downloadAndStore(
   supabaseService: any,
   url: string,
   storageBucket: string,
   filePath: string,
   contentType: string,
 ) {
   try {
     const resp = await fetch(url);
     if (!resp.ok) return null;
     const buffer = await resp.arrayBuffer();
     const blob = new Blob([buffer], { type: contentType });

     const { error: uploadError } = await supabaseService.storage
       .from(storageBucket)
       .upload(filePath, blob, { contentType, upsert: true });

     if (uploadError) {
       console.error("[music-generate] Upload error:", uploadError);
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

 async function fetchKieRecordInfo(taskId: string, apiKey: string) {
   const kieResp = await fetch(
     `https://api.kie.ai/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
     {
       headers: { "Authorization": `Bearer ${apiKey}` },
     },
   );

   if (!kieResp.ok) {
     const errText = await kieResp.text();
     throw new Error(`KIE.ai poll error: ${kieResp.status} ${errText}`);
   }

   return await kieResp.json();
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
  const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/music-callback`;

  try {
    if (!KIE_API_KEY) {
      throw new Error("KIE_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    // ── Trial Token Check: music ──
    const trial = await checkAndConsumeTrialToken(supabaseService, user.id, 'music', 1);
    if (!trial.allowed) {
      return new Response(
        JSON.stringify({ error: 'TRIAL_LIMIT_REACHED', feature: 'music' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ── End Trial Token Check ──

    if (req.method !== "POST") {
      throw new Error("Method not allowed");
    }

    const body = await req.json();

    // KIE.ai request fields
    const prompt = (body?.prompt || "").toString().trim();
    const style = (body?.style || "").toString().trim();
    const title = (body?.title || "").toString().trim();
    const customMode = Boolean(body?.customMode ?? true);
    const instrumental = Boolean(body?.instrumental ?? false);
    const model = (body?.model || "V5_5").toString();
    const negativeTags = (body?.negativeTags || "").toString().trim();
    const vocalGender = body?.vocalGender as "m" | "f" | undefined;
    const styleWeight = typeof body?.styleWeight === "number" ? body.styleWeight : undefined;
    const weirdnessConstraint = typeof body?.weirdnessConstraint === "number" ? body.weirdnessConstraint : undefined;
    const audioWeight = typeof body?.audioWeight === "number" ? body.audioWeight : undefined;
    const personaId = (body?.personaId || "").toString().trim();
    const personaModel = (body?.personaModel || "").toString().trim();
    const durationHint = typeof body?.duration_seconds === "number" ? body.duration_seconds : null;
    const { prompt: promptLimit, style: styleLimit } = getModelLimits(model);

    if (title.length > 80) {
      throw new Error("Title exceeds 80 characters");
    }

    if (customMode) {
      if (style.length > styleLimit) {
        throw new Error(`Style exceeds ${styleLimit} characters for model ${model}`);
      }

      if (!instrumental && prompt.length > promptLimit) {
        throw new Error(`Prompt exceeds ${promptLimit} characters for model ${model}`);
      }
    } else if (prompt.length > 500) {
      throw new Error("Non-custom mode prompt exceeds 500 characters");
    }

    // Validation per API rules
    if (customMode) {
      if (instrumental && (!style || !title)) {
        throw new Error("Custom instrumental mode requires style and title");
      }
      if (!instrumental && (!style || !title || !prompt)) {
        throw new Error("Custom lyrical mode requires style, title, and prompt (lyrics)");
      }
    } else {
      if (!prompt) {
        throw new Error("Non-custom mode requires prompt");
      }
    }

    // Build KIE.ai request payload
    const kiePayload: Record<string, unknown> = {
      customMode,
      instrumental,
      model,
      callBackUrl: CALLBACK_URL,
      prompt,
    };

    if (customMode) {
      kiePayload.style = style;
      kiePayload.title = title;
      if (negativeTags) kiePayload.negativeTags = negativeTags;
      if (vocalGender && !instrumental) kiePayload.vocalGender = vocalGender;
      if (styleWeight !== undefined) kiePayload.styleWeight = styleWeight;
      if (weirdnessConstraint !== undefined) kiePayload.weirdnessConstraint = weirdnessConstraint;
      if (audioWeight !== undefined) kiePayload.audioWeight = audioWeight;
      if (personaId) kiePayload.personaId = personaId;
      if (personaModel) kiePayload.personaModel = personaModel;
    }

    console.log("[music-generate] Calling KIE.ai generate", { model, customMode, instrumental });

    const kieResp = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify(kiePayload),
    });

    if (!kieResp.ok) {
      const errText = await kieResp.text();
      throw new Error(`KIE.ai error: ${kieResp.status} ${errText}`);
    }

    const kieData = await kieResp.json();

    if (kieData.code !== 200 || !kieData.data?.taskId) {
      throw new Error(`KIE.ai rejected request: ${kieData.msg || "Unknown error"}`);
    }

    const taskId = kieData.data.taskId as string;

    console.log("[music-generate] KIE.ai taskId received", taskId);

    const { data: placeholderData, error: placeholderError } = await supabaseService
      .from("user_music_tracks")
      .insert({
        user_id: user.id,
        task_id: taskId,
        title: title || null,
        prompt: prompt || null,
        include_styles: style ? [style] : null,
        requested_duration_seconds: durationHint ? Math.round(durationHint) : null,
        provider: "kie",
        model: model,
        storage_path: null,
        signed_url: null,
        mime: "audio/mpeg",
        meta: {
          status: "generating",
          saved: false,
          customMode,
          instrumental,
          style: style || null,
          negativeTags: negativeTags || null,
          vocalGender: vocalGender || null,
        },
      })
      .select("id")
      .single();

    if (placeholderError) {
      console.error("[music-generate] Failed to insert placeholder:", placeholderError);
      throw placeholderError;
    }

    const recordId = placeholderData?.id as string;

    console.log("[music-generate] Placeholder row created", recordId);

    let finalKieData: any = null;
    let finalStatus = "pending";
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await sleep(3000);
      }

      const polledData = await fetchKieRecordInfo(taskId, KIE_API_KEY);
      const polledStatus = (polledData?.data?.status ?? "").toString().toUpperCase();

      console.log("[music-generate] Poll result", { taskId, attempt: attempt + 1, status: polledStatus });

      if (polledStatus === "SUCCESS") {
        finalKieData = polledData;
        finalStatus = "completed";
        break;
      }

      if (polledStatus === "FAILED" || polledStatus === "ERROR") {
        finalKieData = polledData;
        finalStatus = "failed";
        break;
      }
    }

    if (finalStatus === "failed") {
      const failureMessage = finalKieData?.data?.errorMessage || "Generation failed";
      await supabaseService
        .from("user_music_tracks")
        .update({
          meta: {
            status: "failed",
            error: failureMessage,
          },
        })
        .eq("id", recordId);

      return new Response(JSON.stringify({
        taskId,
        recordId,
        status: "failed",
        error: failureMessage,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (finalStatus !== "completed") {
      return new Response(JSON.stringify({
        taskId,
        recordId,
        status: "generating",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sunoData: SunoTrack[] = finalKieData?.data?.response?.sunoData ?? [];

    if (sunoData.length === 0) {
      throw new Error("KIE.ai returned success without tracks");
    }

    const timestamp = Date.now();
    const savedTracks: Array<{ id: string; audioUrl: string; coverUrl: string | null; duration: number | null; title: string | null; variantIndex: number }> = [];

    for (let i = 0; i < sunoData.length; i++) {
      const track = sunoData[i];
      const isFirst = i === 0;
      const audioFileName = `${user.id}/${timestamp}_${taskId.slice(0, 8)}_v${i}.mp3`;
      const publicAudioUrl = await downloadAndStore(supabaseService, track.audioUrl, "music", audioFileName, "audio/mpeg");

      let publicCoverUrl: string | null = null;
      if (track.imageUrl) {
        const coverFileName = `${user.id}/${timestamp}_${taskId.slice(0, 8)}_v${i}.jpeg`;
        publicCoverUrl = await downloadAndStore(supabaseService, track.imageUrl, "music-covers", coverFileName, "image/jpeg");
      }

      const trackMeta = {
        status: "completed",
        saved: false,
        customMode,
        instrumental,
        style: style || null,
        negativeTags: negativeTags || null,
        vocalGender: vocalGender || null,
        kie_track_id: track.id,
        model_name: track.modelName,
        tags: track.tags,
      };

      if (isFirst) {
        const { error: updateError } = await supabaseService
          .from("user_music_tracks")
          .update({
            storage_path: audioFileName,
            signed_url: publicAudioUrl,
            cover_url: publicCoverUrl,
            source_audio_url: track.audioUrl,
            duration: track.duration ?? null,
            title: track.title || title || null,
            variant_index: 0,
            mime: "audio/mpeg",
            meta: trackMeta,
          })
          .eq("id", recordId);

        if (updateError) {
          throw updateError;
        }

        savedTracks.push({
          id: recordId,
          audioUrl: publicAudioUrl ?? track.audioUrl,
          coverUrl: publicCoverUrl,
          duration: track.duration ?? null,
          title: track.title || title || null,
          variantIndex: 0,
        });
      } else {
        const { data: insertedRow, error: insertError } = await supabaseService
          .from("user_music_tracks")
          .insert({
            user_id: user.id,
            task_id: taskId,
            title: track.title || title || null,
            prompt: track.prompt || prompt || null,
            include_styles: style ? [style] : null,
            requested_duration_seconds: durationHint ? Math.round(durationHint) : null,
            provider: "kie",
            model: model,
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

        if (insertError) {
          throw insertError;
        }

        savedTracks.push({
          id: insertedRow.id,
          audioUrl: publicAudioUrl ?? track.audioUrl,
          coverUrl: publicCoverUrl,
          duration: track.duration ?? null,
          title: track.title || title || null,
          variantIndex: i,
        });
      }
    }

    return new Response(JSON.stringify({
      taskId,
      recordId,
      status: "completed",
      tracks: savedTracks,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[music-generate] Error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: (error as Error).message || "Music generation failed",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
