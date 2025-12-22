import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Service Account JSON (preferred for Vertex/Gemini publisher model permissions)
const GOOGLE_APPLICATION_CREDENTIALS_JSON = Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON');

// Gemini API Key for Gemini 2.5 Flash TTS
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// Flexibly locate a Google TTS key from env without requiring an exact name (fallback)
const envObj = Deno.env.toObject?.() ?? {} as Record<string, string>;
const googleKeyCandidates = Object.keys(envObj)
  .filter((k) => /GOOGLE/.test(k) && /TTS/.test(k) && /KEY/.test(k));
let GOOGLE_TTS_KEY: string | undefined = Deno.env.get('GOOGLE_TTS_KEY') || Deno.env.get('GOOGLE_TTS_API_KEY');
let GOOGLE_TTS_KEY_NAME: string | undefined = GOOGLE_TTS_KEY ? (Deno.env.get('GOOGLE_TTS_KEY') ? 'GOOGLE_TTS_KEY' : (Deno.env.get('GOOGLE_TTS_API_KEY') ? 'GOOGLE_TTS_API_KEY' : undefined)) : undefined;
if (!GOOGLE_TTS_KEY) {
  for (const name of googleKeyCandidates) {
    const val = envObj[name];
    if (val && val.trim().length > 0) {
      GOOGLE_TTS_KEY = val.trim();
      GOOGLE_TTS_KEY_NAME = name;
      break;
    }
  }
}

// Effective key to call Google Cloud Text-to-Speech endpoint.
// IMPORTANT: Gemini TTS here is accessed via the Cloud Text-to-Speech API, so a Cloud API key is required.
// Prefer GOOGLE_TTS_KEY (Cloud key). Fall back to GEMINI_API_KEY only if it's actually a Cloud key.
const GEMINI_TTS_KEY = GOOGLE_TTS_KEY || GEMINI_API_KEY;

console.log("🎵 VOICE TTS: Function loaded (Gemini 2.5 Flash TTS + Google fallback)");
console.log("🎵 Gemini API Key available:", !!GEMINI_API_KEY);
console.log("🎵 Google TTS Key picked:", GOOGLE_TTS_KEY_NAME || "<not found>");
console.log("🎵 Google TTS Key available:", !!GOOGLE_TTS_KEY);
console.log("🎵 Gemini TTS effective key source:", GOOGLE_TTS_KEY ? (GOOGLE_TTS_KEY_NAME || 'GOOGLE_TTS_KEY') : (GEMINI_API_KEY ? 'GEMINI_API_KEY' : '<none>'));

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type GoogleServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedGoogleAccessToken: { token: string; expiresAtMs: number } | null = null;

function base64UrlEncode(input: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...input));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pemToDer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN[\s\S]*?-----/g, '')
    .replace(/-----END[\s\S]*?-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function signJwtRs256(privateKeyPem: string, signingInput: string): Promise<string> {
  const keyData = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = Uint8Array.from(utf8Bytes(signingInput));
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    data
  );
  return base64UrlEncode(new Uint8Array(signature));
}

async function getGoogleAccessTokenFromServiceAccount(): Promise<string | null> {
  if (!GOOGLE_APPLICATION_CREDENTIALS_JSON) return null;

  try {
    if (cachedGoogleAccessToken && cachedGoogleAccessToken.expiresAtMs > Date.now() + 60_000) {
      return cachedGoogleAccessToken.token;
    }

    const sa = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS_JSON) as GoogleServiceAccountJson;
    if (!sa?.client_email || !sa?.private_key) {
      console.error('🎵 Service account JSON is missing client_email/private_key');
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 3600;
    const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const scope = 'https://www.googleapis.com/auth/cloud-platform';

    const header = base64UrlEncode(utf8Bytes(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const payload = base64UrlEncode(utf8Bytes(JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud,
      iat: nowSec,
      exp: expSec,
      scope,
    })));
    const signingInput = `${header}.${payload}`;
    const sig = await signJwtRs256(sa.private_key, signingInput);
    const assertion = `${signingInput}.${sig}`;

    const tokenResp = await fetch(aud, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    const tokenText = await tokenResp.text();
    if (!tokenResp.ok) {
      console.error('🎵 Failed to fetch Google OAuth token:', tokenResp.status, tokenText);
      return null;
    }

    const tokenJson = JSON.parse(tokenText) as { access_token?: string; expires_in?: number };
    if (!tokenJson.access_token) {
      console.error('🎵 OAuth token response missing access_token');
      return null;
    }

    const expiresIn = Math.max(60, tokenJson.expires_in ?? 3600);
    cachedGoogleAccessToken = {
      token: tokenJson.access_token,
      expiresAtMs: Date.now() + expiresIn * 1000,
    };

    return tokenJson.access_token;
  } catch (e) {
    console.error('🎵 Error generating OAuth token from service account:', e);
    return null;
  }
}

// ============================================================================
// GEMINI 2.5 FLASH TTS - "Neural Actor" Configuration
// ============================================================================

// Voice mapping: Leda (female, sophisticated/warm), Orion (male, deep/authoritative)
const GEMINI_VOICES = {
  female: 'Leda',
  male: 'Puck',
};

// System prompt for the "Wakti Elite" Vocal Engine (used in Gemini TTS prompt field)
const WAKTI_VOCAL_PROMPT = `Role: You are the 'Wakti Elite' Vocal Engine. You are a professional Neural Actor.
Objective: Deliver speech with regional prestige, natural prosody, and emotional intelligence.

1. ENGLISH (CANADIAN ELITE):
   - Persona: A smart, professional technical lead from Toronto.
   - Tone: Friendly, crisp, and neutral North American.
   - Rules: Avoid exaggerated US accents. Keep vowels polite and rounded. Pace: 1.05x.

2. ARABIC (GCC / QATARI MAJLIS):
   - Persona: A high-status cultural attaché from Doha.
   - Dialect: 100% White Khaliji (Qatari).
   - Rules: ABSOLUTELY NO Formal MSA (Fusha). Soften 'Qaf' (ق) into a hard 'G'. 
   - Suffixes: Use natural Gulf 'K' breaths. 
   - Rhythm: Warm, rhythmic, and elite.

3. ADAPTIVE LOGIC:
   - Greeting: Do not add any greeting. Read the provided text exactly as-is.
   - Data: If reading sports/stocks, speak with precision and clarity.`;

// Build the style prompt for Gemini TTS based on language
const getStylePrompt = (isArabic: boolean): string => {
  if (isArabic) {
    return `${WAKTI_VOCAL_PROMPT}

For this text, use the ARABIC (GCC / QATARI MAJLIS) persona.
Hard requirements:
- Pure Gulf / Khaliji / Qatari. NOT Egyptian. NOT Levantine. NOT MSA/Fusha.
- Soften the Qaf (ق) into a hard G sound (گ) in pronunciation.
- Warm, rhythmic majlis delivery with elite Doha vibe.
- Avoid Egyptian markers/pronunciation (for example: إزايك / قوي / أوي).
Read the text exactly as provided (no added greetings).`;
  }
  return `${WAKTI_VOCAL_PROMPT}

For this text, use the ENGLISH (CANADIAN ELITE) persona. Speak with friendly, crisp, neutral North American tone.`;
};

// Phonetic anchors to force the AI into the correct accent mode
const getPhoneticAnchor = (_isArabic: boolean, _userName?: string) => {
  return '';
};

// Detect if text is primarily Arabic
const isArabicText = (text: string): boolean => {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && (arabicChars / totalChars) > 0.3;
};

// Get language code for Gemini TTS
const getLanguageCode = (isArabic: boolean): string => {
  return isArabic ? 'ar-EG' : 'en-US';
};

// --- Helpers for robust long-text TTS ---
// Split text into safe chunks for Google TTS: by sentence boundaries first, then hard-wrap long sentences.
function splitIntoChunks(text: string, maxChars: number = 350): string[] {
  try {
    if (!text) return [];
    // Normalize whitespace
    const t = String(text).replace(/\s+/g, ' ').trim();
    if (!t) return [];

    // First pass: split into sentences, keeping end punctuation (., !, ?, Arabic ؟)
    const sentences = t.match(/[^.!?؟]+[.!?؟]?/g) || [t];

    const chunks: string[] = [];
    for (const sRaw of sentences) {
      const s = sRaw.trim();
      if (!s) continue;
      if (s.length <= maxChars) {
        chunks.push(s);
        continue;
      }
      // Second pass: break long sentence on commas / Arabic comma / semicolons
      const parts = s.split(/[,؛،;]/g).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) {
        // Fallback: hard wrap by words
        chunks.push(...hardWrap(s, maxChars));
        continue;
      }
      // Accumulate parts into <= maxChars segments
      let buf = '';
      for (const p of parts) {
        const candidate = buf ? (buf + ', ' + p) : p;
        if (candidate.length <= maxChars) {
          buf = candidate;
        } else {
          if (buf) chunks.push(buf);
          if (p.length <= maxChars) {
            buf = p;
          } else {
            chunks.push(...hardWrap(p, maxChars));
            buf = '';
          }
        }
      }
      if (buf) chunks.push(buf);
    }

    // Merge tiny trailing chunks with previous to reduce over-splitting
    const merged: string[] = [];
    for (const c of chunks) {
      if (merged.length > 0 && (c.length < 60)) {
        const last = merged.pop() as string;
        const combined = last + ' ' + c;
        if (combined.length <= maxChars + 40) {
          merged.push(combined);
        } else {
          merged.push(last, c);
        }
      } else {
        merged.push(c);
      }
    }
    return merged;
  } catch {
    return [text];
  }
}

function hardWrap(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const word of s.split(' ')) {
    if (!word) continue;
    const candidate = current ? (current + ' ' + word) : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) out.push(current);
      // If single word longer than max, force split
      if (word.length > maxChars) {
        let w = word;
        while (w.length > maxChars) {
          out.push(w.slice(0, maxChars));
          w = w.slice(maxChars);
        }
        current = w;
      } else {
        current = word;
      }
    }
  }
  if (current) out.push(current);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

serve(async (req: Request) => {
  console.log(`🎵 Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎵 Authenticated user: ${user.id}`);

    // Get request data
    const requestBody = await req.json();
    const { text, voice_id, mode, gender, user_name } = requestBody;
    
    console.log(`🎵 TTS request:`, {
      textLength: text?.length || 0,
      voiceId: voice_id,
      gender: gender,
      textPreview: text?.substring(0, 100)
    });

    // Zero-cost warmup path: keep function hot without calling external TTS
    if (mode === 'warmup') {
      console.log('🎵 Warmup ping received, skipping provider call.');
      return new Response(JSON.stringify({ ok: true, warmed: true, ts: Date.now() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!text) {
      throw new Error('Missing required field: text is required');
    }

    // Determine if text is Arabic
    const textIsArabic = isArabicText(text);
    
    // Determine voice gender from voice_id or explicit gender param
    let voiceGender: 'male' | 'female' = 'male';
    if (gender === 'female') {
      voiceGender = 'female';
    } else if (voice_id) {
      // Detect from legacy voice_id patterns
      const lowerVoice = voice_id.toLowerCase();
      if (lowerVoice.includes('zephyr') || lowerVoice.includes('vindemiatrix') || lowerVoice.includes('leda') || lowerVoice.includes('female')) {
        voiceGender = 'female';
      }
    }

    // ========================================================================
    // PRIMARY: Gemini 2.5 Flash TTS
    // ========================================================================
    const bearerToken = await getGoogleAccessTokenFromServiceAccount();

    if (bearerToken || GEMINI_TTS_KEY) {
      console.log('🎵 Using Gemini 2.5 Flash TTS (Neural Actor mode)');
      
      const geminiVoice = GEMINI_VOICES[voiceGender];
      const languageCode = getLanguageCode(textIsArabic);
      
      // Prepend phonetic anchor to force accent mode
      const phoneticAnchor = getPhoneticAnchor(textIsArabic, user_name);
      const preparedText = phoneticAnchor + text;
      
      console.log(`🎵 Gemini TTS config:`, {
        voice: geminiVoice,
        language: languageCode,
        isArabic: textIsArabic,
        gender: voiceGender,
        textLength: preparedText.length
      });

      // Build the style prompt for Neural Actor mode
      const stylePrompt = getStylePrompt(textIsArabic);
      
      const geminiUrl = bearerToken
        ? 'https://texttospeech.googleapis.com/v1/text:synthesize'
        : `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_TTS_KEY}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({
            input: {
              text: preparedText,
              prompt: stylePrompt, // Neural Actor style instructions
            },
            voice: {
              languageCode: languageCode,
              name: geminiVoice,
              model_name: 'gemini-2.5-flash-tts', // Use Gemini TTS model
            },
            audioConfig: {
              audioEncoding: 'LINEAR16', // WAV format for better browser compatibility
              sampleRateHertz: 24000,
            },
        }),
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const audioContent = geminiData.audioContent;

        if (audioContent) {
          const audioBytes = base64ToBytes(audioContent);
          console.log('🎵 Gemini TTS audio generated successfully:', { audioSize: audioBytes.byteLength });

          // Log successful AI usage
          await logAIFromRequest(req, {
            functionName: "voice-tts",
            provider: "gemini",
            model: "gemini-2.5-flash-tts",
            inputText: text,
            status: "success",
            metadata: {
              voice: geminiVoice,
              language: languageCode,
              audioSize: audioBytes.byteLength,
              isArabic: textIsArabic,
            }
          });

          return new Response(audioBytes.buffer as ArrayBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'audio/wav',
              'Content-Length': audioBytes.byteLength.toString(),
              'X-TTS-Provider': 'gemini-2.5-flash-tts',
              'X-TTS-Voice': geminiVoice,
            },
          });
        }

        // Option B: Gemini is configured; do NOT fall back. Surface the real error.
        console.error('🎵 Gemini TTS succeeded but returned no audioContent');
        return new Response(JSON.stringify({
          success: false,
          provider: 'gemini',
          error: 'Gemini TTS returned no audioContent',
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-TTS-Provider': 'gemini-2.5-flash-tts' },
        });
      }

      // Option B: Gemini is configured; do NOT fall back. Surface Gemini error.
      const errorText = await geminiResponse.text();
      console.error('🎵 Gemini TTS failed (no fallback):', geminiResponse.status, errorText);
      return new Response(JSON.stringify({
        success: false,
        provider: 'gemini',
        status: geminiResponse.status,
        error: errorText?.slice(0, 2000) || 'Gemini TTS failed',
      }), {
        status: geminiResponse.status || 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-TTS-Provider': 'gemini-2.5-flash-tts',
          'X-TTS-Voice': geminiVoice,
        },
      });
    }

    // ========================================================================
    // FALLBACK: Google Cloud TTS (Chirp3-HD)
    // ========================================================================
    console.log('🎵 Using Google Cloud TTS fallback (Chirp3-HD)');
    
    // Check Google configuration
    if (!GOOGLE_TTS_KEY) {
      console.error('🎵 Neither GEMINI_API_KEY nor GOOGLE_TTS_KEY found in environment');
      throw new Error('TTS API keys not configured');
    }

    if (!voice_id) {
      throw new Error('Missing required field: voice_id is required for Google TTS fallback');
    }

    // Google-only; no external style settings

    // NOTE: No voice quota enforcement here. This endpoint is reserved for Talk Back / Mini Speaker.
    // Quota checks and usage persistence are handled exclusively by the ElevenLabs endpoint `elevenlabs-tts`.

    // Perform TTS call with Google only — now with server-side chunking and concatenation
      console.log('🎵 Calling Google Cloud Text-to-Speech API (chunked)...');
      console.log('🎵 Request details:', { voiceName: voice_id, textLength: text.length });

      // Derive languageCode from the voice name (e.g., en-US-Chirp3-HD-Orus -> en-US)
      const deriveLang = (name: string) => {
        const parts = (name || '').split('-');
        if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
        // Fallback by rough detection
        if (/^ar/i.test(name)) return 'ar-XA';
        return 'en-US';
      };
      const languageCode = deriveLang(voice_id);

      const synthesize = async (name: string, t: string) => {
        const lang = deriveLang(name);
        const isChirp = /Chirp3/i.test(name);
        const apiBase = isChirp
          ? `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${GOOGLE_TTS_KEY}`
          : `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`;
        const resp = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: t },
            voice: { 
              name,
              languageCode: lang,
              // Add support for Chirp3 HD voices
              ssmlGender: name.includes('HD-Orus') || name.includes('HD-Schedar') ? 'MALE' : 
                         name.includes('HD-Zephyr') || name.includes('HD-Vindemiatrix') ? 'FEMALE' : 'NEUTRAL'
            },
            audioConfig: { 
              audioEncoding: 'MP3',
              // Add effects profile for better voice quality (match Google demo)
              effectsProfileId: name.includes('Chirp3-HD') 
                ? ['headphone-class-device', 'small-bluetooth-speaker-class-device'] 
                : []
            }
          })
        });
        return resp;
      };

      // Fast path: single-call synthesis for typical lengths to avoid MP3 concatenation issues on iOS
      if ((text?.length || 0) <= 4500) {
        let resp = await synthesize(voice_id, text);
        if (!resp.ok && (resp.status === 400 || resp.status === 404)) {
          const isArabic = /^ar/i.test(languageCode);
          const fallbackVoice = isArabic ? 'ar-XA-Chirp3-HD-Schedar' : 'en-US-Chirp3-HD-Orus';
          console.warn('🎵 Google TTS voice failed (single-call), retry with fallback:', fallbackVoice);
          resp = await synthesize(fallbackVoice, text);
        }
        if (!resp.ok) {
          const errTxt = await resp.text();
          console.error('🎵 Google TTS API error (single):', { status: resp.status, err: errTxt });
          if (resp.status === 401 || resp.status === 403) {
            throw new Error('Google TTS authentication/authorization failed - check API key and quotas');
          }
          throw new Error(`Google TTS API error: ${resp.status} - ${errTxt}`);
        }
        const json = await resp.json();
        const b64 = json.audioContent as string | undefined;
        if (!b64) throw new Error('Google TTS returned no audioContent');
        const bytes = base64ToBytes(b64);
        const audioBuffer = bytes.buffer as ArrayBuffer;
        console.log('🎵 Google TTS audio generated successfully (single):', { audioSize: audioBuffer.byteLength });
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.byteLength.toString()
          }
        });
      } else {
        // Fallback for very long texts: existing chunking with concatenation
        // Split the input text into safe chunks
        const chunks = splitIntoChunks(text);
        if (!chunks.length) throw new Error('No text to synthesize');

        const audioSegments: Uint8Array[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const part = chunks[i];
          console.log(`🎵 Synthesizing chunk ${i + 1}/${chunks.length} (len=${part.length})`);
          let resp = await synthesize(voice_id, part);
          if (!resp.ok && (resp.status === 400 || resp.status === 404)) {
            const isArabic = /^ar/i.test(languageCode);
            const fallbackVoice = isArabic ? 'ar-XA-Chirp3-HD-Schedar' : 'en-US-Chirp3-HD-Orus';
            console.warn('🎵 Google TTS voice failed for chunk, retry with fallback:', fallbackVoice);
            resp = await synthesize(fallbackVoice, part);
          }
          if (!resp.ok) {
            const errTxt = await resp.text();
            console.error('🎵 Google TTS API error (chunk):', { status: resp.status, err: errTxt });
            if (resp.status === 401 || resp.status === 403) {
              throw new Error('Google TTS authentication/authorization failed - check API key and quotas');
            }
            throw new Error(`Google TTS API error: ${resp.status} - ${errTxt}`);
          }
          const json = await resp.json();
          const b64 = json.audioContent as string | undefined;
          if (!b64) throw new Error('Google TTS returned no audioContent for a chunk');
          audioSegments.push(base64ToBytes(b64));
        }

        // Concatenate MP3 byte arrays – players can play concatenated MP3 frames sequentially
        const total = audioSegments.reduce((sum, seg) => sum + seg.byteLength, 0);
        const joined = new Uint8Array(total);
        let offset = 0;
        for (const seg of audioSegments) { joined.set(seg, offset); offset += seg.byteLength; }
        const audioBuffer = joined.buffer as ArrayBuffer;
        console.log('🎵 Google TTS audio generated successfully (concatenated):', { chunks: audioSegments.length, audioSize: audioBuffer.byteLength });

        // Log successful AI usage
        await logAIFromRequest(req, {
          functionName: "voice-tts",
          provider: "google",
          model: "google-tts-chirp3",
          inputText: text,
          status: "success",
          metadata: { chunks: audioSegments.length, audioSize: audioBuffer.byteLength }
        });

        // NOTE: No voice quota mutation here. Persist usage only in `elevenlabs-tts`.

        return new Response(audioBuffer, {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.byteLength.toString()
          }
        });
      }

  } catch (error: unknown) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as { message: string }).message : 'TTS generation failed';
    console.error('🎵 TTS error:', error);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "voice-tts",
      provider: "google",
      model: "google-tts-chirp3",
      status: "error",
      errorMessage: message
    });

    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
