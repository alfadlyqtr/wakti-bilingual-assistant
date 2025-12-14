import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { logAI } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Flexibly locate a Google TTS key from env without requiring an exact name
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

console.log("🎵 VOICE TTS: Function loaded (Google-only)");
console.log("🎵 Google TTS Key picked:", GOOGLE_TTS_KEY_NAME || "<not found>");
console.log("🎵 Google TTS Key available:", !!GOOGLE_TTS_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// No style mapping needed for Google-only path

// --- Helpers for robust long-text TTS ---
// Split text into safe chunks for Google TTS: by sentence boundaries first, then hard-wrap long sentences.
function splitIntoChunks(text: string, maxChars: number = 350): string[] {
  try {
    if (!text) return [];
    // Normalize whitespace
    let t = String(text).replace(/\s+/g, ' ').trim();
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
    const { text, voice_id, mode } = requestBody;
    
    console.log(`🎵 TTS request:`, {
      textLength: text?.length || 0,
      voiceId: voice_id,
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

    // Check Google configuration
    if (!GOOGLE_TTS_KEY) {
      console.error('🎵 GOOGLE_TTS_KEY not found in environment');
      throw new Error('Google TTS key not configured');
    }

    if (!text || !voice_id) {
      throw new Error('Missing required fields: text and voice_id are required');
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
        await logAI({
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
    await logAI({
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
