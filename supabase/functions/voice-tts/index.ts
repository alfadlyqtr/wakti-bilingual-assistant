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
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

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

const TTS_PROVIDER = (Deno.env.get('TTS_PROVIDER') || 'google').toLowerCase();

console.log("🎵 VOICE TTS: Function loaded");
console.log("🎵 TTS Provider:", TTS_PROVIDER);
console.log("🎵 ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);
console.log("🎵 Google TTS Key picked:", GOOGLE_TTS_KEY_NAME || "<not found>");
console.log("🎵 Google TTS Key available:", !!GOOGLE_TTS_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Updated voice style configurations with corrected mappings for eleven_multilingual_v2
const VOICE_STYLES = {
  neutral: { stability: 0.7, similarity_boost: 0.85, style: 0.0, use_speaker_boost: true },
  report: { stability: 0.8, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true },
  storytelling: { stability: 0.5, similarity_boost: 0.7, style: 0.6, use_speaker_boost: true },
  poetry: { stability: 0.4, similarity_boost: 0.6, style: 0.7, use_speaker_boost: true },
  teacher: { stability: 0.8, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true },
  sports: { stability: 0.3, similarity_boost: 0.5, style: 0.8, use_speaker_boost: true }
};

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
    const { text, voice_id, style = 'neutral', mode } = requestBody;
    
    console.log(`🎵 TTS request:`, {
      textLength: text?.length || 0,
      voiceId: voice_id,
      style: style,
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

    // Check provider configuration
    if (TTS_PROVIDER === 'google') {
      if (!GOOGLE_TTS_KEY) {
        console.error('🎵 GOOGLE_TTS_KEY not found in environment');
        throw new Error('Google TTS key not configured');
      }
    } else {
      if (!ELEVENLABS_API_KEY) {
        console.error('🎵 ELEVENLABS_API_KEY not found in environment');
        throw new Error('ElevenLabs API key not configured');
      }
    }

    if (!text || !voice_id) {
      throw new Error('Missing required fields: text and voice_id are required');
    }

    // Get the appropriate voice settings for the selected style
    const voiceSettings = VOICE_STYLES[style as keyof typeof VOICE_STYLES] || VOICE_STYLES.neutral;
    console.log(`🎵 Using voice settings for style "${style}":`, voiceSettings);

    // Check user's voice quota before proceeding
    console.log(`🎵 Checking voice quota for user: ${user.id}`);
    const { data: quotaData, error: quotaError } = await supabase.rpc('get_or_create_user_voice_quota', {
      p_user_id: user.id
    });

    if (quotaError) {
      console.error('🎵 Error checking voice quota:', quotaError);
      throw new Error('Failed to check voice quota');
    }

    if (!quotaData || quotaData.length === 0) {
      throw new Error('No quota data found');
    }

    const quota = quotaData[0];
    const remainingChars = Math.max(0, quota.characters_limit - quota.characters_used);
    const totalAvailable = remainingChars + quota.extra_characters;
    
    console.log(`🎵 Voice quota check:`, {
      used: quota.characters_used,
      limit: quota.characters_limit,
      extra: quota.extra_characters,
      remaining: remainingChars,
      totalAvailable: totalAvailable,
      textLength: text.length
    });

    if (text.length > totalAvailable) {
      throw new Error(`Text length (${text.length}) exceeds available quota (${totalAvailable})`);
    }

    // Perform TTS call according to selected provider
    let audioBuffer: ArrayBuffer;
    if (TTS_PROVIDER === 'google') {
      console.log('🎵 Calling Google Cloud Text-to-Speech API...');
      console.log('🎵 Request details:', { voiceName: voice_id, textLength: text.length });
      const googleResp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}` , {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: { name: voice_id },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

      if (!googleResp.ok) {
        const errorText = await googleResp.text();
        console.error('🎵 Google TTS API error:', {
          status: googleResp.status,
          statusText: googleResp.statusText,
          error: errorText,
          voiceName: voice_id,
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
      audioBuffer = bytes.buffer;
      console.log('🎵 Google TTS audio generated successfully:', { audioSize: bytes.byteLength });
    } else {
      console.log(`🎵 Calling ElevenLabs TTS API with eleven_multilingual_v2 model...`);
      console.log(`🎵 Request details:`, {
        voiceId: voice_id,
        textLength: text.length,
        model: 'eleven_multilingual_v2',
        voiceSettings
      });

      const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: voiceSettings,
          output_format: 'mp3_22050_32'
        }),
      });

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        console.error('🎵 ElevenLabs API error:', {
          status: elevenLabsResponse.status,
          statusText: elevenLabsResponse.statusText,
          error: errorText,
          voiceId: voice_id,
          model: 'eleven_multilingual_v2'
        });
        if (elevenLabsResponse.status === 401) {
          throw new Error('ElevenLabs API authentication failed - check API key');
        } else if (elevenLabsResponse.status === 404) {
          throw new Error(`Voice ID ${voice_id} not found in ElevenLabs - voice may have been deleted`);
        } else if (elevenLabsResponse.status === 422) {
          throw new Error('Invalid voice settings or text format');
        } else {
          throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`);
        }
      }

      audioBuffer = await elevenLabsResponse.arrayBuffer();
      console.log(`🎵 ElevenLabs audio generated successfully:`, {
        audioSize: audioBuffer.byteLength,
        voiceStyle: style,
        model: 'eleven_multilingual_v2'
      });
      if (audioBuffer.byteLength === 0) {
        throw new Error('Received empty audio data from ElevenLabs API');
      }
    }

    // Update user's voice usage
    console.log(`🎵 Updating voice usage for user: ${user.id}`);
    const { error: updateError } = await supabase
      .from('user_voice_usage')
      .upsert({
        user_id: user.id,
        characters_used: (quota.characters_used || 0) + text.length,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('🎵 Error updating voice usage:', updateError);
      // Continue anyway - don't fail the TTS generation
    } else {
      console.log(`🎵 Voice usage updated: +${text.length} characters`);
    }

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
