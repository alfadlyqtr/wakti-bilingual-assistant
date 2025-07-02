import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

console.log("🔊 ELEVENLABS TTS: Function loaded");
console.log("🔊 ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req) => {
  console.log(`🔊 Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if API key is available
    if (!ELEVENLABS_API_KEY) {
      console.error('🔊 ELEVENLABS_API_KEY not found in environment');
      throw new Error('ElevenLabs API key not configured');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🔊 Authenticated user: ${user.id}`);

    // Get request data
    const requestBody = await req.json();
    const { text, voice_id, voice_style = 'natural' } = requestBody;
    
    console.log(`🔊 TTS request:`, {
      textLength: text?.length || 0,
      voiceId: voice_id,
      voiceStyle: voice_style,
      textPreview: text?.substring(0, 100)
    });

    if (!text || !voice_id) {
      throw new Error('Missing required fields: text and voice_id are required');
    }

    // Check character quota (6000 soft limit)
    const charCount = text.length;
    console.log(`🔊 Character count: ${charCount}`);

    // Get current usage
    const { data: usage } = await supabase
      .from('user_voice_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const currentUsage = usage?.characters_used || 0;
    const newTotal = currentUsage + charCount;

    if (newTotal > 6000) {
      console.warn(`🔊 User exceeding quota: ${newTotal}/6000 characters`);
      // Soft limit - warn but don't block
    }

    // Map voice styles to ElevenLabs format
    const styleMapping: Record<string, string> = {
      'natural': 'conversational',
      'poem': 'narration',
      'dramatic': 'dramatic',
      'calm': 'calm',
      'excited': 'news',
      'serious': 'storytelling'
    };

    const elevenlabsStyle = styleMapping[voice_style] || 'conversational';

    console.log(`🔊 Calling ElevenLabs TTS API...`);

    // Call ElevenLabs TTS API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_v3',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: elevenlabsStyle
        },
        output_format: 'mp3_44100_128'
      }),
    });

    console.log(`🔊 ElevenLabs TTS response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔊 ElevenLabs TTS error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`ElevenLabs TTS error: ${response.status} - ${errorText}`);
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();
    console.log(`🔊 Audio generated, size: ${audioBuffer.byteLength} bytes`);

    // Upload audio to Supabase storage
    const fileName = `${user.id}/${Date.now()}_${voice_id}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-generated-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('🔊 Storage upload error:', uploadError);
      throw new Error(`Failed to store audio: ${uploadError.message}`);
    }

    // Get signed URL for download
    const { data: signedUrlData } = await supabase.storage
      .from('voice-generated-audio')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    // Update usage quota
    await supabase
      .from('user_voice_usage')
      .upsert({
        user_id: user.id,
        characters_used: newTotal,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    console.log(`🔊 TTS successful, usage updated: ${newTotal}/6000 characters`);

    return new Response(JSON.stringify({
      success: true,
      audio_url: signedUrlData?.signedUrl,
      file_path: fileName,
      character_count: charCount,
      total_usage: newTotal,
      quota_warning: newTotal > 5000 ? `Warning: ${newTotal}/6000 characters used` : null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🔊 TTS error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Text-to-speech failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});