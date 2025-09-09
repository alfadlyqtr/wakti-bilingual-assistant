import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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

    // Perform TTS call with Google only
      console.log('🎵 Calling Google Cloud Text-to-Speech API...');
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

      const synthesize = async (name: string) => {
        const lang = deriveLang(name);
        const isChirp = /Chirp3/i.test(name);
        const apiBase = isChirp
          ? `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${GOOGLE_TTS_KEY}`
          : `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`;
        const resp = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
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

      let googleResp = await synthesize(voice_id);
      if (!googleResp.ok && (googleResp.status === 400 || googleResp.status === 404)) {
        // One-time fallback to a safe voice based on language
        const isArabic = /^ar/i.test(languageCode);
        const fallbackVoice = isArabic ? 'ar-XA-Chirp3-HD-Schedar' : 'en-US-Chirp3-HD-Orus';
        console.warn('🎵 Google TTS voice failed, retrying with fallback voice:', fallbackVoice);
        googleResp = await synthesize(fallbackVoice);
      }

      if (!googleResp.ok) {
        const errorText = await googleResp.text();
        console.error('🎵 Google TTS API error:', {
          status: googleResp.status,
          statusText: googleResp.statusText,
          error: errorText,
          voiceName: voice_id,
          languageCode,
        });
        if (googleResp.status === 401 || googleResp.status === 403) {
          throw new Error('Google TTS authentication/authorization failed - check API key and quotas');
        }
        throw new Error(`Google TTS API error: ${googleResp.status} - ${errorText}`);
      }

      const googleJson = await googleResp.json();
      const b64 = googleJson.audioContent as string | undefined;
      if (!b64) {
        throw new Error('Google TTS returned no audioContent');
      }
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBuffer = bytes.buffer as ArrayBuffer;
      console.log('🎵 Google TTS audio generated successfully:', { audioSize: audioBuffer.byteLength });
    

    // NOTE: No voice quota mutation here. Persist usage only in `elevenlabs-tts`.

    return new Response(audioBuffer, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString()
      }
    });

  } catch (error: unknown) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as { message: string }).message : 'TTS generation failed';
    console.error('🎵 TTS error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
