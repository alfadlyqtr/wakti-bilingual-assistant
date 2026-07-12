import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildTrialErrorPayload, checkTrialAccess } from "../_shared/trial-tracker.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Poem Reader — dedicated spoken-word narration pipeline.
// This function NEVER shares code, prompts, or hard-locks with music-generate.
// Voice always comes from a real speech engine (ElevenLabs via KIE). Suno is
// only ever used here to build a pure instrumental bed — no lyrics, no vocals,
// no singing risk, ever.
// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KIE_JOBS_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_SUNO_URL = "https://api.kie.ai/api/v1/generate";
const SPEECH_MODEL = "elevenlabs/text-to-speech-multilingual-v2";

// Dedicated native-accent voice IDs per language — English and Arabic never
// share a voice. Same raw ElevenLabs voice IDs already proven in production
// via presentation-elevenlabs-tts / generate-speech.
const VOICE_MAP: Record<string, Record<"m" | "f", string>> = {
  en: { m: "uju3wxzG5OhpWcoi3SMy", f: "gh8WokH7VR2QkmMmwWHS" },
  ar: { m: "George", f: "Sarah" },
};

const BACKGROUND_STYLE_PROMPTS: Record<string, string> = {
  acoustic:
    "warm acoustic guitar and soft upright bass, continuous gentle ambient instrumental bed, calm and intimate, no drums, no percussion, no melodic lead, no vocals, no singing",
  oud:
    "soft traditional oud and light qanun texture, continuous gentle ambient instrumental bed, calm and intimate, no drums, no percussion, no melodic lead, no vocals, no singing",
};

const ALLOWED_DURATIONS = [30, 60, 90, 120, 150, 180, 210];

// Turns plain poem lines into real, timed pauses using ElevenLabs' native
// break-tag syntax (confirmed supported up to ~3s per break). Single line
// breaks get a short breath; blank-line stanza breaks get a longer pause.
function applyNaturalPauses(rawText: string): string {
  const stanzas = rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  return stanzas
    .map((stanza) =>
      stanza
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' <break time="0.5s" /> ')
    )
    .join(' <break time="1.2s" /> ');
}

function pickDurationBucket(lyrics: string): number {
  const words = lyrics.split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round(words / 2.2) + 15;
  return ALLOWED_DURATIONS.find((d) => d >= estimatedSeconds) ?? 210;
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
  const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/poem-callback`;

  try {
    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
    if (req.method !== "POST") throw new Error("Method not allowed");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Authentication failed");

    // Reuses the existing 'music' trial bucket — Poem Reader lives in the same
    // Studio hub/entitlement as Music, this only shares quota accounting, not code.
    const trial = await checkTrialAccess(supabaseService, user.id, "music", 1);
    if (!trial.allowed) {
      return new Response(JSON.stringify(buildTrialErrorPayload("music", trial)), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const title = (body?.title || "Poem").toString().trim().slice(0, 80) || "Poem";
    const language = body?.language === "ar" ? "ar" : "en";
    const lyrics = (body?.lyrics || "").toString().trim();
    const vocalGender = body?.vocalGender === "f" ? "f" : "m";
    const backgroundStyle = ["acoustic", "oud"].includes(body?.backgroundStyle) ? body.backgroundStyle : "none";

    if (!lyrics) throw new Error("Poem text is required");
    if (lyrics.length > 4500) throw new Error("Poem text is too long (max 4500 characters)");

    const voiceId = VOICE_MAP[language][vocalGender];
    const pacedText = applyNaturalPauses(lyrics);

    // ── Job 1: Speech — the ONLY source of the voice. Real narration engine. ──
    const speechResp = await fetch(KIE_JOBS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        callBackUrl: CALLBACK_URL,
        input: {
          text: pacedText,
          voice: voiceId,
          stability: 1.0,
          similarity_boost: 1.0,
          style: 0.5,
          speed: 0.92,
          timestamps: false,
          previous_text: "",
          next_text: "",
          language_code: language,
        },
      }),
    });
    const speechData = await speechResp.json();
    const speechTaskId: string | null = speechData?.data?.taskId || null;
    if (!speechResp.ok || !speechTaskId) {
      console.error("[poem-generate] speech submission failed:", speechData);
      throw new Error(speechData?.msg || "Failed to start voice generation");
    }

    // ── Job 2: Instrumental bed only — Suno never receives the poem's words. ──
    let instrumentalTaskId: string | null = null;
    if (backgroundStyle !== "none") {
      try {
        const instResp = await fetch(KIE_SUNO_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            customMode: true,
            instrumental: true,
            model: "V5_5",
            style: BACKGROUND_STYLE_PROMPTS[backgroundStyle],
            negativeTags: "singing, vocals, chant, drums, percussion, clapping",
            callBackUrl: CALLBACK_URL,
          }),
        });
        const instData = await instResp.json();
        instrumentalTaskId = instData?.data?.taskId || null;
        if (!instResp.ok || !instrumentalTaskId) {
          console.warn("[poem-generate] instrumental submission failed, falling back to voice-only:", instData);
          instrumentalTaskId = null;
        }
      } catch (instError) {
        console.warn("[poem-generate] instrumental submission threw, falling back to voice-only:", instError);
        instrumentalTaskId = null;
      }
    }
    void pickDurationBucket; // reserved for future duration-aware instrumental requests

    const { data: row, error: insertError } = await supabaseService
      .from("user_poem_tracks")
      .insert({
        user_id: user.id,
        title,
        language,
        lyrics,
        voice_id: voiceId,
        vocal_gender: vocalGender,
        background_style: instrumentalTaskId ? backgroundStyle : "none",
        speech_task_id: speechTaskId,
        speech_status: "processing",
        instrumental_task_id: instrumentalTaskId,
        instrumental_status: instrumentalTaskId ? "processing" : "skipped",
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    return new Response(JSON.stringify({ trackId: row.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[poem-generate] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
