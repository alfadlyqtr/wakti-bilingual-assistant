// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIFromRequest } from "../_shared/aiLogger.ts";
import { buildTrialErrorPayload, checkTrialAccess } from "../_shared/trial-tracker.ts";

// Orchestrator edge function for Tasjeel.
// Replaces the multi-step client-side coordination:
//   transcribe-audio → summarize-text → generate-speech → updateTasjeelRecord
// The frontend now calls this one function and polls/subscribes for status changes.
//
// Input:
//   { recordId: string, audioUrl: string, language?: 'ar' | 'en', voice?: 'male' | 'female' | 'auto' }
//
// Output:
//   { transcript, summary, summaryAudioPath, status }
//
// The record in tasjeel_records is updated at each step via processing_status.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const ELEVENLABS_VOICE_SETTINGS = {
  stability: 1.0,
  similarity_boost: 1.0,
  style: 0.5,
  use_speaker_boost: true,
};
const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  ar_male: "G1QUjBCuRBbLbAmYlTgl",
  en_male: "ZB6Q1KAIKj9o7p9iJEWQ",
  ar_female: "u0TsaWvt0v8migutHM3M",
  en_female: "gh8WokH7VR2QkmMmwWHS",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function extractStoragePath(url: string, bucket: string): string {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) throw new Error(`URL does not contain expected bucket path: ${bucket}`);
  return url.slice(idx + marker.length);
}

async function updateStatus(
  supabase: any,
  recordId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  await supabase
    .from("tasjeel_records")
    .update({ processing_status: status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", recordId);
}

function isArabicText(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const matches = text.match(arabicPattern) || [];
  return text.length > 0 && matches.length / text.length > 0.3;
}

function resolveElevenLabsVoiceId(summary: string, language: string, voice: string): string {
  const lang = language === "ar" || language === "en"
    ? language
    : isArabicText(summary) ? "ar" : "en";
  const gender = voice === "female" ? "female" : voice === "male" ? "male" : lang === "ar" ? "female" : "male";
  return ELEVENLABS_VOICE_MAP[`${lang}_${gender}`] || ELEVENLABS_VOICE_MAP.en_male;
}

function resolveOpenAIVoice(summary: string, voice: string): string {
  if (voice === "female") return "nova";
  if (voice === "male") return "onyx";
  return isArabicText(summary) ? "nova" : "onyx";
}

async function generateSpeechWithElevenLabs(summary: string, language: string, voice: string) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const voiceId = resolveElevenLabsVoiceId(summary, language, voice);
  const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Accept": "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: summary,
      model_id: ELEVENLABS_MODEL,
      voice_settings: ELEVENLABS_VOICE_SETTINGS,
    }),
  });

  if (!ttsResp.ok) {
    const msg = await ttsResp.text();
    throw new Error(`ElevenLabs TTS error ${ttsResp.status}: ${msg.slice(0, 500)}`);
  }

  return {
    audioBuffer: await ttsResp.arrayBuffer(),
    provider: "elevenlabs",
    model: "elevenlabs-tts",
    resolvedVoice: voiceId,
  };
}

async function generateSpeechWithOpenAI(summary: string, voice: string, openaiApiKey: string) {
  const voiceOption = resolveOpenAIVoice(summary, voice);
  const ttsResp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: summary, voice: voiceOption, response_format: "mp3" }),
  });

  if (!ttsResp.ok) {
    const msg = await ttsResp.text();
    throw new Error(`OpenAI TTS error ${ttsResp.status}: ${msg.slice(0, 500)}`);
  }

  return {
    audioBuffer: await ttsResp.arrayBuffer(),
    provider: "openai",
    model: "tts-1",
    resolvedVoice: voiceOption,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing env vars" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── Trial check ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  let userId: string | null = null;

  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (user) {
      userId = user.id;
      const trial = await checkTrialAccess(supabase, user.id, "tasjeel", 1);
      if (!trial.allowed) {
        return new Response(
          JSON.stringify(buildTrialErrorPayload("tasjeel", trial)),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
  }

  // ── Parse input ──────────────────────────────────────────────────────────
  let recordId: string, audioUrl: string, language: string, voice: string;
  try {
    const body = await req.json();
    recordId = body.recordId;
    audioUrl = (body.audioUrl as string || "").trim();
    language = body.language || "en";
    voice = body.voice || "auto";
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!recordId || !audioUrl) {
    return new Response(
      JSON.stringify({ error: "recordId and audioUrl are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Step 1: Transcription ────────────────────────────────────────────────
  await updateStatus(supabase, recordId, "transcribing");

  let transcript = "";
  try {
    let cleanUrl = audioUrl;
    try { cleanUrl = decodeURIComponent(audioUrl).trim(); } catch { /* keep original */ }

    const filePath = extractStoragePath(cleanUrl, "tasjeel_recordings");
    const { data: audioBlob, error: dlErr } = await supabase.storage
      .from("tasjeel_recordings")
      .download(filePath);

    if (dlErr || !audioBlob) throw new Error(dlErr?.message || "Failed to download audio");

    const storageMime = (audioBlob as Blob).type || "audio/webm";
    let uploadMime = storageMime;
    let uploadExt = "webm";
    if (storageMime.includes("audio/mp4") || storageMime.includes("audio/m4a")) { uploadMime = "audio/mp4"; uploadExt = "m4a"; }
    else if (storageMime.includes("audio/mpeg") || storageMime.includes("audio/mp3")) { uploadMime = "audio/mpeg"; uploadExt = "mp3"; }

    const formData = new FormData();
    formData.append("file", new Blob([audioBlob], { type: uploadMime }), `audio.${uploadExt}`);
    formData.append("model", "gpt-4o-transcribe");
    if (language === "ar" || language === "en") formData.append("language", language);

    const t0 = Date.now();
    const txResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: formData,
    });

    if (!txResp.ok) {
      const msg = await txResp.text();
      throw new Error(`OpenAI transcription error ${txResp.status}: ${msg}`);
    }

    const txJson = await txResp.json();
    transcript = txJson.text || "";

    await logAIFromRequest(req, {
      functionName: "tasjeel-process/transcribe",
      provider: "openai",
      model: "gpt-4o-transcribe",
      outputText: transcript,
      durationMs: Date.now() - t0,
      status: "success",
    });

    await updateStatus(supabase, recordId, "summarizing", { transcription: transcript });
  } catch (err) {
    const msg = (err as Error).message;
    await updateStatus(supabase, recordId, "failed", { error_message: `Transcription failed: ${msg}` });
    return new Response(
      JSON.stringify({ error: "Transcription failed", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Step 2: Summarization ────────────────────────────────────────────────
  let summary = "";
  try {
    const isArabic = language === "ar";
    const systemPrompt = isArabic
      ? `أنت مُلخّص محترف للاجتماعات/المحاضرات/جلسات العصف الذهني. حدّد نوع الجلسة وقدّم ملخصاً واضحاً ومنظماً. استخرج: نوع الجلسة، العنوان، النقاط الرئيسية، القرارات، عناصر العمل، الأسماء، المواقع، التواريخ، الأسئلة المفتوحة. كن موجزاً.`
      : `You are a professional summarizer for meetings, lectures, and brainstorms. Detect the session type and produce a clear structured summary. Extract: Session Type, Title, Main Points, Decisions, Action Items, Names, Locations, Dates/Times, Open Questions. Be succinct.`;

    const t0 = Date.now();
    const sumResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!sumResp.ok) {
      const msg = await sumResp.text();
      throw new Error(`OpenAI summarization error ${sumResp.status}: ${msg}`);
    }

    const sumJson = await sumResp.json();
    summary = sumJson.choices?.[0]?.message?.content || "";

    await logAIFromRequest(req, {
      functionName: "tasjeel-process/summarize",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: transcript,
      outputText: summary,
      durationMs: Date.now() - t0,
      status: "success",
    });

    await updateStatus(supabase, recordId, "generating_speech", { summary });
  } catch (err) {
    const msg = (err as Error).message;
    // Summarization failure is partial — transcription succeeded, so mark partial
    await updateStatus(supabase, recordId, "partial", {
      error_message: `Summarization failed: ${msg}`,
    });
    return new Response(
      JSON.stringify({ error: "Summarization failed", transcript, details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Step 3: Speech generation ────────────────────────────────────────────
  let summaryAudioPath: string | null = null;
  try {
    const t0 = Date.now();
    let provider = "elevenlabs";
    let model = "elevenlabs-tts";
    let resolvedVoice = resolveElevenLabsVoiceId(summary, language, voice);
    let fallbackReason: string | null = null;
    let audioBuffer: ArrayBuffer;

    try {
      const elevenLabsResult = await generateSpeechWithElevenLabs(summary, language, voice);
      audioBuffer = elevenLabsResult.audioBuffer;
      provider = elevenLabsResult.provider;
      model = elevenLabsResult.model;
      resolvedVoice = elevenLabsResult.resolvedVoice;
    } catch (elevenLabsError) {
      fallbackReason = (elevenLabsError as Error).message;
      console.warn("ElevenLabs TTS failed in tasjeel-process, falling back to OpenAI:", fallbackReason);
      const openAIResult = await generateSpeechWithOpenAI(summary, voice, openaiApiKey);
      audioBuffer = openAIResult.audioBuffer;
      provider = openAIResult.provider;
      model = openAIResult.model;
      resolvedVoice = openAIResult.resolvedVoice;
    }

    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    // Upload summary audio to storage under the user's folder
    const owner = userId ?? "system";
    const audioFileName = `${owner}/summary-${recordId}.mp3`;
    const { error: uploadErr } = await supabase.storage
      .from("tasjeel_recordings")
      .upload(audioFileName, audioBlob, { contentType: "audio/mpeg", upsert: true });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage.from("tasjeel_recordings").getPublicUrl(audioFileName);
    summaryAudioPath = urlData?.publicUrl ?? null;

    await logAIFromRequest(req, {
      functionName: "tasjeel-process/speech",
      provider,
      model,
      inputText: summary,
      durationMs: Date.now() - t0,
      status: "success",
      metadata: { voice: resolvedVoice, fallbackReason },
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.warn("Speech generation failed (non-fatal):", msg);
    // Speech failure is partial — summary exists, audio does not
    await updateStatus(supabase, recordId, "partial", {
      summary,
      summary_audio_path: null,
      error_message: `Speech generation failed: ${msg}`,
    });
    return new Response(
      JSON.stringify({ transcript, summary, summaryAudioPath: null, status: "partial", details: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Step 4: Mark done ────────────────────────────────────────────────────
  await updateStatus(supabase, recordId, "done", {
    transcription: transcript,
    summary,
    summary_audio_path: summaryAudioPath,
    error_message: null,
  });

  return new Response(
    JSON.stringify({ transcript, summary, summaryAudioPath, status: "done" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
