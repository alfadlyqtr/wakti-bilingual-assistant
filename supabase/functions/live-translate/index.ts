import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkTrialAccess, checkAndConsumeTrialTokenOnce, buildTrialErrorPayload, buildTrialSuccessPayload } from "../_shared/trial-tracker.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ElevenLabs voices — legacy cedar/marin keys kept for frontend compatibility
const VOICE_MAP: Record<string, string> = {
  cedar: "TxvUy8tvDazkNBlnGcpU", // male
  marin: "EST9Ui6982FZPSi7gCHi", // female
};

// Fastest ElevenLabs model (~75ms latency) — speed is critical for live translation
const ELEVENLABS_MODEL = "eleven_flash_v2_5";
const ELEVENLABS_VOICE_SETTINGS = {
  stability: 1.0,
  similarity_boost: 1.0,
  style: 0.5,
  use_speaker_boost: true,
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const requestId = (req.headers.get("x-request-id") || "").trim() || crypto.randomUUID();
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trial gate
    const trial = await checkTrialAccess(supabase, user.id, "interpreter", 5);
    if (!trial.allowed) {
      return new Response(JSON.stringify(buildTrialErrorPayload("interpreter", trial)), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const targetLanguage = (formData.get("target_language") as string) || "ar";
    const spokenLanguage = (formData.get("spoken_language") as string) || "en";
    const voiceKey = (formData.get("voice") as string) || "cedar";

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Missing audio file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elevenLabsVoiceId = VOICE_MAP[voiceKey] || VOICE_MAP.cedar;

    // Languages NOT supported by Whisper — pass empty string so Whisper auto-detects
    const WHISPER_UNSUPPORTED = new Set(["rw", "fr_ca"]);

    // ── Step 1: Whisper transcription ──────────────────────────────────────
    console.log("[live-translate] Step 1: Whisper transcription...");
    const whisperLangCode = (spokenLanguage !== "auto" && !WHISPER_UNSUPPORTED.has(spokenLanguage))
      ? spokenLanguage
      : "";
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", whisperLangCode);
    whisperForm.append("response_format", "text");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error("[live-translate] Whisper error:", err);
      return new Response(JSON.stringify({ error: "Transcription failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = (await whisperRes.text()).trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: "No speech detected. Please try again." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[live-translate] Transcript:", transcript);

    // ── Step 2: GPT-4o-mini translation ───────────────────────────────────
    console.log("[live-translate] Step 2: Translating...");
    const LANGUAGE_NAMES: Record<string, string> = {
      en: "English", ar: "Arabic", fr: "French", de: "German", es: "Spanish",
      it: "Italian", pt: "Portuguese", ru: "Russian", zh: "Chinese", ja: "Japanese",
      ko: "Korean", hi: "Hindi", tr: "Turkish", nl: "Dutch", pl: "Polish",
      sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish", he: "Hebrew",
      id: "Indonesian", ms: "Malaysian", th: "Thai", vi: "Vietnamese", uk: "Ukrainian",
      ro: "Romanian", hu: "Hungarian", cs: "Czech", sk: "Slovak", bg: "Bulgarian",
      hr: "Croatian", sr: "Serbian", ca: "Catalan", sq: "Albanian", et: "Estonian",
      lv: "Latvian", lt: "Lithuanian", fa: "Persian", ur: "Urdu", bn: "Bengali",
      sw: "Swahili", mt: "Maltese", lb: "Luxembourgish", is: "Icelandic",
      ka: "Georgian", eu: "Basque", af: "Afrikaans", tl: "Filipino",
      sl: "Slovenian", pa: "Punjabi", nn: "Norwegian Nynorsk", ml: "Malayalam",
      ne: "Nepali", ht: "Haitian Creole", fr_ca: "French (Canada)", be: "Belarusian",
      az: "Azerbaijani", hy: "Armenian", am: "Amharic", rw: "Kinyarwanda",
    };
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: `You are a precise translator. Translate the user's text into ${targetLangName}. Output ONLY the translation — no explanations, no notes, no quotation marks, no original text. Just the clean translated text.` },
          { role: "user", content: transcript },
        ],
      }),
    });

    if (!gptRes.ok) {
      const err = await gptRes.text();
      console.error("[live-translate] GPT error:", err);
      return new Response(JSON.stringify({ error: "Translation failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gptData = await gptRes.json();
    const translation = gptData.choices?.[0]?.message?.content?.trim() || "";
    if (!translation) {
      return new Response(JSON.stringify({ error: "Translation returned empty. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[live-translate] Translation:", translation);

    // ── Step 3: ElevenLabs TTS (Flash v2.5 — ultra-low latency) ────────────
    console.log("[live-translate] Step 3: ElevenLabs TTS voice:", elevenLabsVoiceId);

    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "Voice synthesis not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: translation,
        model_id: ELEVENLABS_MODEL,
        voice_settings: ELEVENLABS_VOICE_SETTINGS,
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("[live-translate] ElevenLabs TTS error:", ttsRes.status, err);
      return new Response(JSON.stringify({ error: "Voice synthesis failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBase64 = arrayBufferToBase64(await ttsRes.arrayBuffer());
    const audioMime = "audio/mpeg";

    const consume = await checkAndConsumeTrialTokenOnce(supabase, user.id, "interpreter", 5, requestId);
    const trialPayload = consume.allowed ? buildTrialSuccessPayload("interpreter", consume) : null;

    console.log("[live-translate] Done.");
    return new Response(
      JSON.stringify({ success: true, transcript, translation, audio_base64: audioBase64, audio_mime: audioMime, trial: trialPayload }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[live-translate] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
