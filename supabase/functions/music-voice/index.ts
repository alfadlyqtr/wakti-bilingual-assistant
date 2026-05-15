import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const AUDIO_BUCKET = "music";
const SUPPORTED_VALIDATE_LANGUAGES = new Set(["en", "zh", "es", "fr", "pt", "de", "ja", "ko", "hi", "ru"]);

type VoiceStatus = "local_only" | "phrase_pending" | "phrase_ready" | "voice_pending" | "ready" | "failed";

type MusicVoiceRow = {
  id: string;
  user_id: string;
  name: string;
  voice_type: "male" | "female" | "custom";
  accent_note: string;
  source_kind: "record" | "upload";
  clip_label: string;
  source_storage_path: string | null;
  source_audio_url: string | null;
  source_duration_seconds: number | null;
  validate_task_id: string | null;
  validate_phrase: string | null;
  validate_language: string | null;
  verify_storage_path: string | null;
  verify_audio_url: string | null;
  generation_task_id: string | null;
  kie_voice_id: string | null;
  status: VoiceStatus;
  status_detail: string | null;
  error_message: string | null;
  is_available: boolean;
  availability_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripDataUrlPrefix(maybeDataUrl?: string): { base64: string; mimeHint?: string } {
  if (maybeDataUrl?.startsWith("data:")) {
    const [meta, data] = maybeDataUrl.split(",", 2);
    const match = /data:([^;]+);base64/.exec(meta || "");
    return { base64: data || "", mimeHint: match?.[1] };
  }
  return { base64: maybeDataUrl || "" };
}

function detectAudioMimeAndExt(bytes: Uint8Array, mimeHint?: string): { mime: string; ext: string } {
  if (mimeHint) {
    if (mimeHint === "audio/webm" || mimeHint === "audio/webm;codecs=opus") return { mime: "audio/webm", ext: "webm" };
    if (mimeHint === "audio/mp4" || mimeHint === "audio/m4a") return { mime: "audio/mp4", ext: "m4a" };
    if (mimeHint === "audio/mpeg" || mimeHint === "audio/mp3") return { mime: "audio/mpeg", ext: "mp3" };
    if (mimeHint === "audio/wav" || mimeHint === "audio/wave" || mimeHint === "audio/x-wav") return { mime: "audio/wav", ext: "wav" };
    if (mimeHint === "audio/ogg") return { mime: "audio/ogg", ext: "ogg" };
  }

  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return { mime: "audio/wav", ext: "wav" };
  }

  if (bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x4d) {
    return { mime: "audio/webm", ext: "webm" };
  }

  if (bytes.length > 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }

  if (bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mime: "audio/mp4", ext: "m4a" };
  }

  return { mime: mimeHint?.split(";")[0] || "audio/webm", ext: "webm" };
}

function normalizeValidateLanguage(language?: string): string {
  const candidate = (language || "").trim().toLowerCase();
  if (SUPPORTED_VALIDATE_LANGUAGES.has(candidate)) return candidate;
  return "en";
}

function buildVoiceStyle(row: Pick<MusicVoiceRow, "voice_type" | "accent_note">): string {
  const parts: string[] = [];
  if (row.voice_type === "male") parts.push("Male Vocal");
  else if (row.voice_type === "female") parts.push("Female Vocal");
  else parts.push("Custom Vocal");
  if (row.accent_note?.trim()) parts.push(row.accent_note.trim());
  return parts.join(", ");
}

async function requireUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Authentication failed");
  return user;
}

async function uploadAudio(params: {
  supabaseService: ReturnType<typeof createClient>;
  userId: string;
  voiceRecordId: string;
  kind: "source" | "verify";
  audioDataUrl: string;
}): Promise<{ storagePath: string; publicUrl: string; mime: string }> {
  const { base64, mimeHint } = stripDataUrlPrefix(params.audioDataUrl);
  if (!base64) throw new Error("Missing audio data");
  const bytes = decodeBase64ToUint8Array(base64);
  const { mime, ext } = detectAudioMimeAndExt(bytes, mimeHint);
  const storagePath = `voice-inputs/${params.userId}/${params.voiceRecordId}/${params.kind}-${Date.now()}.${ext}`;
  const { error: uploadError } = await params.supabaseService.storage
    .from(AUDIO_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: true });
  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);
  const { data: urlData } = params.supabaseService.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl || "";
  if (!publicUrl) throw new Error("Could not build audio URL");
  return { storagePath, publicUrl, mime };
}

async function getVoiceRowOrThrow(supabaseService: ReturnType<typeof createClient>, userId: string, voiceRecordId: string): Promise<MusicVoiceRow> {
  const { data, error } = await supabaseService
    .from("user_music_voices")
    .select("*")
    .eq("id", voiceRecordId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Voice record not found");
  return data as MusicVoiceRow;
}

async function updateVoiceRow(supabaseService: ReturnType<typeof createClient>, voiceRecordId: string, patch: Record<string, unknown>): Promise<MusicVoiceRow> {
  const { data, error } = await supabaseService
    .from("user_music_voices")
    .update(patch)
    .eq("id", voiceRecordId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to update voice record");
  return data as MusicVoiceRow;
}

async function queryValidationInfo(kieApiKey: string, taskId: string) {
  const resp = await fetch(`https://api.kie.ai/api/v1/voice/validate-info?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${kieApiKey}` },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`KIE validate-info error: ${resp.status} ${text}`);
  return JSON.parse(text);
}

async function queryVoiceRecord(kieApiKey: string, taskId: string) {
  const resp = await fetch(`https://api.kie.ai/api/v1/voice/record-info?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${kieApiKey}` },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`KIE record-info error: ${resp.status} ${text}`);
  return JSON.parse(text);
}

async function checkVoiceAvailability(kieApiKey: string, taskId: string) {
  const resp = await fetch("https://api.kie.ai/api/v1/voice/check-voice", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kieApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ task_id: taskId }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`KIE check-voice error: ${resp.status} ${text}`);
  return JSON.parse(text);
}

async function refreshVoiceStatus(params: {
  supabaseService: ReturnType<typeof createClient>;
  kieApiKey: string;
  row: MusicVoiceRow;
}): Promise<MusicVoiceRow> {
  const { supabaseService, kieApiKey, row } = params;

  if (row.status === "phrase_pending" && row.validate_task_id) {
    const info = await queryValidationInfo(kieApiKey, row.validate_task_id);
    const data = info?.data || {};
    const rawStatus = (data.status || "").toString();
    const status = rawStatus.toLowerCase();
    if ((status === "wait_validating" || status === "success") && data.validateInfo) {
      return await updateVoiceRow(supabaseService, row.id, {
        validate_phrase: data.validateInfo,
        status: "phrase_ready",
        status_detail: rawStatus,
        error_message: null,
      });
    }
    if (status === "processing_validate_fail" || status === "fail") {
      return await updateVoiceRow(supabaseService, row.id, {
        status: "failed",
        status_detail: rawStatus,
        error_message: data.errorMessage || info?.msg || "Phrase generation failed",
      });
    }
    return await updateVoiceRow(supabaseService, row.id, {
      status_detail: rawStatus || "wait_processing",
    });
  }

  if ((row.status === "voice_pending" || !!row.generation_task_id) && row.generation_task_id) {
    const info = await queryVoiceRecord(kieApiKey, row.generation_task_id);
    const data = info?.data || {};
    const rawStatus = (data.status || "").toString();
    const status = rawStatus.toLowerCase();

    if (status === "success" && data.voiceId) {
      const availability = await checkVoiceAvailability(kieApiKey, row.generation_task_id);
      const isAvailable = Boolean(availability?.data?.isAvailable);
      return await updateVoiceRow(supabaseService, row.id, {
        kie_voice_id: data.voiceId,
        status: isAvailable ? "ready" : "voice_pending",
        status_detail: rawStatus,
        error_message: null,
        is_available: isAvailable,
        availability_checked_at: new Date().toISOString(),
      });
    }

    if (status === "processing_validate_fail" || status === "fail") {
      return await updateVoiceRow(supabaseService, row.id, {
        status: "failed",
        status_detail: rawStatus,
        error_message: data.errorMessage || info?.msg || "Voice generation failed",
      });
    }

    return await updateVoiceRow(supabaseService, row.id, {
      status_detail: rawStatus || "wait_processing",
    });
  }

  if (row.kie_voice_id && row.generation_task_id && !row.is_available) {
    const availability = await checkVoiceAvailability(kieApiKey, row.generation_task_id);
    const isAvailable = Boolean(availability?.data?.isAvailable);
    return await updateVoiceRow(supabaseService, row.id, {
      status: isAvailable ? "ready" : row.status,
      is_available: isAvailable,
      availability_checked_at: new Date().toISOString(),
      error_message: null,
    });
  }

  return row;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";
  const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/music-voice-callback`;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (req.method !== "POST") throw new Error("Method not allowed");
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");

    const user = await requireUser(req, supabase);
    const body = await req.json();
    const action = (body?.action || "").toString();

    if (action === "create-validation") {
      const name = (body?.name || "").toString().trim();
      const voiceType = body?.voiceType === "male" || body?.voiceType === "female" ? body.voiceType : "custom";
      const accentNote = (body?.accentNote || "").toString().trim();
      const sourceKind = body?.sourceKind === "upload" ? "upload" : "record";
      const clipLabel = (body?.clipLabel || "").toString().trim();
      const audioDataUrl = (body?.audioDataUrl || "").toString();
      const sourceDurationSeconds = typeof body?.sourceDurationSeconds === "number" ? Math.max(1, Math.round(body.sourceDurationSeconds)) : null;
      const validateLanguage = normalizeValidateLanguage((body?.validateLanguage || "").toString());

      if (!name) throw new Error("Voice name is required");
      if (!clipLabel) throw new Error("Voice clip is required");
      if (!audioDataUrl) throw new Error("Voice audio is required");

      const { data: inserted, error: insertError } = await supabaseService
        .from("user_music_voices")
        .insert({
          user_id: user.id,
          name,
          voice_type: voiceType,
          accent_note: accentNote,
          source_kind: sourceKind,
          clip_label: clipLabel,
          source_duration_seconds: sourceDurationSeconds,
          validate_language: validateLanguage,
          status: "phrase_pending",
          status_detail: "uploading_source",
        })
        .select("*")
        .single();
      if (insertError || !inserted) throw new Error(insertError?.message || "Could not create voice record");

      const row = inserted as MusicVoiceRow;
      const uploaded = await uploadAudio({
        supabaseService,
        userId: user.id,
        voiceRecordId: row.id,
        kind: "source",
        audioDataUrl,
      });

      const vocalStartS = 0;
      const vocalEndS = Math.max(vocalStartS + 1, Math.min(sourceDurationSeconds ?? 10, 30));
      const kieResp = await fetch("https://api.kie.ai/api/v1/voice/validate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceUrl: uploaded.publicUrl,
          vocalStartS,
          vocalEndS,
          language: validateLanguage,
          callBackUrl: CALLBACK_URL,
        }),
      });
      const kieText = await kieResp.text();
      if (!kieResp.ok) throw new Error(`KIE validate error: ${kieResp.status} ${kieText}`);
      const kieData = JSON.parse(kieText);
      if (kieData?.code !== 200 || !kieData?.data?.taskId) {
        throw new Error(kieData?.msg || "KIE did not return a validation task");
      }

      const nextRow = await updateVoiceRow(supabaseService, row.id, {
        source_storage_path: uploaded.storagePath,
        source_audio_url: uploaded.publicUrl,
        validate_task_id: kieData.data.taskId,
        status: "phrase_pending",
        status_detail: "wait_processing",
        error_message: null,
      });

      return new Response(JSON.stringify({ voice: nextRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-voice") {
      const voiceRecordId = (body?.voiceRecordId || "").toString().trim();
      const verifyAudioDataUrl = (body?.verifyAudioDataUrl || "").toString();
      if (!voiceRecordId) throw new Error("Voice record is required");
      if (!verifyAudioDataUrl) throw new Error("Verification recording is required");

      const row = await getVoiceRowOrThrow(supabaseService, user.id, voiceRecordId);
      if (!row.validate_task_id) throw new Error("Validation task is missing");
      if (!row.validate_phrase) throw new Error("Validation phrase is not ready yet");

      const uploaded = await uploadAudio({
        supabaseService,
        userId: user.id,
        voiceRecordId: row.id,
        kind: "verify",
        audioDataUrl: verifyAudioDataUrl,
      });

      const payload = {
        taskId: row.validate_task_id,
        verifyUrl: uploaded.publicUrl,
        voiceName: row.name,
        description: row.accent_note ? `Music voice - ${row.accent_note}` : `Music voice - ${row.voice_type}`,
        style: buildVoiceStyle(row),
        callBackUrl: CALLBACK_URL,
        calBackUrl: CALLBACK_URL,
      };

      const kieResp = await fetch("https://api.kie.ai/api/v1/voice/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const kieText = await kieResp.text();
      if (!kieResp.ok) throw new Error(`KIE generate voice error: ${kieResp.status} ${kieText}`);
      const kieData = JSON.parse(kieText);
      if (kieData?.code !== 200 || !kieData?.data?.taskId) {
        throw new Error(kieData?.msg || "KIE did not return a voice generation task");
      }

      const nextRow = await updateVoiceRow(supabaseService, row.id, {
        verify_storage_path: uploaded.storagePath,
        verify_audio_url: uploaded.publicUrl,
        generation_task_id: kieData.data.taskId,
        status: "voice_pending",
        status_detail: "wait_processing",
        error_message: null,
      });

      return new Response(JSON.stringify({ voice: nextRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh") {
      const voiceRecordId = (body?.voiceRecordId || "").toString().trim();
      if (!voiceRecordId) throw new Error("Voice record is required");
      const row = await getVoiceRowOrThrow(supabaseService, user.id, voiceRecordId);
      const nextRow = await refreshVoiceStatus({ supabaseService, kieApiKey: KIE_API_KEY, row });
      return new Response(JSON.stringify({ voice: nextRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const voiceRecordId = (body?.voiceRecordId || "").toString().trim();
      if (!voiceRecordId) throw new Error("Voice record is required");
      const row = await getVoiceRowOrThrow(supabaseService, user.id, voiceRecordId);
      const storagePaths = [row.source_storage_path, row.verify_storage_path].filter((value): value is string => Boolean(value));
      if (storagePaths.length > 0) {
        await supabaseService.storage.from(AUDIO_BUCKET).remove(storagePaths);
      }
      const { error } = await supabaseService.from("user_music_voices").delete().eq("id", voiceRecordId).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported action");
  } catch (error) {
    console.error("[music-voice] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message || "Music voice request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
