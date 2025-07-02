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

console.log("🎵 VOICE TTS: Function loaded");
console.log("🎵 ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

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

serve(async (req) => {
  console.log(`🎵 Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if API key is available
    if (!ELEVENLABS_API_KEY) {
      console.error('🎵 ELEVENLABS_API_KEY not found in environment');
      throw new Error('ElevenLabs API key not configured');
    }

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
    const { text, voice_id, style = 'neutral' } = requestBody;
    
    console.log(`🎵 TTS request:`, {
      textLength: text?.length || 0,
      voiceId: voice_id,
      style: style,
      textPreview: text?.substring(0, 100)
    });

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

    console.log(`🎵 Calling ElevenLabs TTS API with eleven_multilingual_v2 model...`);
    console.log(`🎵 Request details:`, {
      voiceId: voice_id,
      textLength: text.length,
      model: 'eleven_multilingual_v2',
      voiceSettings
    });

    // Call ElevenLabs TTS API with the corrected model and settings
    const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2', // Updated: Use the latest model
        voice_settings: voiceSettings
      }),
    });

    console.log(`🎵 ElevenLabs API response status: ${elevenLabsResponse.status}`);
    console.log(`🎵 ElevenLabs API response headers:`, Object.fromEntries(elevenLabsResponse.headers.entries()));

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('🎵 ElevenLabs API error:', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        error: errorText,
        voiceId: voice_id,
        model: 'eleven_multilingual_v2'
      });
      
      // More specific error handling
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

    // Get the audio data
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    console.log(`🎵 Audio generated successfully:`, {
      audioSize: audioBuffer.byteLength,
      voiceStyle: style,
      model: 'eleven_multilingual_v2'
    });

    if (audioBuffer.byteLength === 0) {
      throw new Error('Received empty audio data from ElevenLabs API');
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

  } catch (error) {
    console.error('🎵 TTS error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'TTS generation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
