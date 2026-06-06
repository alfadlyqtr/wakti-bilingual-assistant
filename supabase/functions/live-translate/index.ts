import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkTrialAccess, checkAndConsumeTrialTokenOnce, buildTrialErrorPayload, buildTrialSuccessPayload } from "../_shared/trial-tracker.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GOOGLE_TTS_KEY = Deno.env.get("GOOGLE_TTS_KEY") || Deno.env.get("GOOGLE_TTS_API_KEY") || "";
const GEMINI_TTS_KEY = GOOGLE_TTS_KEY || GEMINI_API_KEY;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Gemini 2.5 Flash TTS voices (mirrors voice-tts function)
const VOICE_MAP: Record<string, string> = {
  cedar: "Puck",   // Male
  marin: "Leda",   // Female
};

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

    // Trial gate — reuse interpreter quota (5 for free users)
    const trial = await checkTrialAccess(supabase, user.id, "interpreter", 5);
    if (!trial.allowed) {
      return new Response(JSON.stringify(buildTrialErrorPayload("interpreter", trial)), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form: audio file + metadata
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

    const geminiVoice = VOICE_MAP[voiceKey] || "Puck";

    // ── Step 1: Whisper transcription ──────────────────────────────────────
    console.log("[live-translate] Step 1: Whisper transcription...");
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, audioFile.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", spokenLanguage !== "auto" ? spokenLanguage : "");
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

    // Get target language full name for the prompt
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
    };
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a precise translator. Translate the user's text into ${targetLangName}. Output ONLY the translation — no explanations, no notes, no quotation marks, no original text. Just the clean translated text.`,
          },
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

    // ── Step 3: Gemini 2.5 Flash TTS ──────────────────────────────────────
    // Uses generativelanguage.googleapis.com — works with GEMINI_API_KEY (AI Studio).
    // texttospeech.googleapis.com requires a Google Cloud key (different product).
    console.log("[live-translate] Step 3: Gemini 2.5 Flash TTS voice:", geminiVoice);
    const ttsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: translation }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: geminiVoice },
              },
            },
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("[live-translate] Gemini TTS error:", ttsRes.status, err);
      return new Response(JSON.stringify({ error: "Voice synthesis failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsData = await ttsRes.json();
    const audioPart = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const audioBase64 = audioPart?.data as string | undefined;
    const audioMime = (audioPart?.mimeType as string) || "audio/wav";
    if (!audioBase64) {
      console.error("[live-translate] Gemini TTS no audio:", JSON.stringify(ttsData).slice(0, 300));
      return new Response(JSON.stringify({ error: "Voice synthesis returned empty audio. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume trial token
    const consume = await checkAndConsumeTrialTokenOnce(supabase, user.id, "interpreter", 5, requestId);
    const trialPayload = consume.allowed ? buildTrialSuccessPayload("interpreter", consume) : null;

    console.log("[live-translate] Done. Returning transcript + translation + audio.");
    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        translation,
        audio_base64: audioBase64,
        audio_mime: audioMime,
        trial: trialPayload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[live-translate] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
