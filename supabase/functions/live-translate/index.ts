import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkTrialAccess, checkAndConsumeTrialTokenOnce, buildTrialErrorPayload, buildTrialSuccessPayload } from "../_shared/trial-tracker.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const GOOGLE_APPLICATION_CREDENTIALS_JSON = Deno.env.get("GOOGLE_APPLICATION_CREDENTIALS_JSON") || "";
const GOOGLE_TTS_KEY = Deno.env.get("GOOGLE_TTS_KEY") || Deno.env.get("GOOGLE_TTS_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Gemini 2.5 Flash TTS voices — Cloud TTS API names
const VOICE_MAP: Record<string, string> = {
  cedar: "Puck",
  marin: "Leda",
};

// ── OAuth token cache ─────────────────────────────────────────────────────
type ServiceAccountJson = { client_email: string; private_key: string; token_uri?: string };
let cachedToken: { token: string; expiresAtMs: number } | null = null;

function pemToDer(pem: string): ArrayBuffer {
  const cleaned = pem.replace(/-----BEGIN[\s\S]*?-----/g, "").replace(/-----END[\s\S]*?-----/g, "").replace(/\s+/g, "");
  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function b64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleBearerToken(): Promise<string | null> {
  if (!GOOGLE_APPLICATION_CREDENTIALS_JSON) return null;
  try {
    if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) return cachedToken.token;
    const sa = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON) as ServiceAccountJson;
    const nowSec = Math.floor(Date.now() / 1000);
    const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
    const enc = new TextEncoder();
    const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const payload = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, aud, iat: nowSec, exp: nowSec + 3600, scope: "https://www.googleapis.com/auth/cloud-platform" })));
    const sigInput = `${header}.${payload}`;
    const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const sig = b64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(sigInput))));
    const tokenResp = await fetch(aud, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${sigInput}.${sig}` }).toString() });
    if (!tokenResp.ok) { console.error("[live-translate] OAuth token error:", await tokenResp.text()); return null; }
    const tokenJson = await tokenResp.json() as { access_token?: string; expires_in?: number };
    if (!tokenJson.access_token) return null;
    cachedToken = { token: tokenJson.access_token, expiresAtMs: Date.now() + (tokenJson.expires_in ?? 3600) * 1000 };
    return tokenJson.access_token;
  } catch (e) { console.error("[live-translate] OAuth error:", e); return null; }
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

    const geminiVoice = VOICE_MAP[voiceKey] || "Puck";

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

    // ── Step 3: Cloud Text-to-Speech API ──────────────────────────────────
    console.log("[live-translate] Step 3: Cloud TTS voice:", geminiVoice);
    const bearerToken = await getGoogleBearerToken();
    const ttsUrl = bearerToken
      ? "https://texttospeech.googleapis.com/v1/text:synthesize"
      : `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`;
    const ttsHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (bearerToken) ttsHeaders["Authorization"] = `Bearer ${bearerToken}`;

    if (!bearerToken && !GOOGLE_TTS_KEY) {
      return new Response(JSON.stringify({ error: "Voice synthesis not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: ttsHeaders,
      body: JSON.stringify({
        input: { text: translation },
        voice: { languageCode: "en-US", name: geminiVoice, model_name: "gemini-2.5-flash-tts" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("[live-translate] Cloud TTS error:", ttsRes.status, err);
      return new Response(JSON.stringify({ error: "Voice synthesis failed. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsData = await ttsRes.json();
    const audioBase64 = ttsData?.audioContent as string | undefined;
    if (!audioBase64) {
      console.error("[live-translate] Cloud TTS no audio:", JSON.stringify(ttsData).slice(0, 300));
      return new Response(JSON.stringify({ error: "Voice synthesis returned empty audio. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const audioMime = "audio/mp3";

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
