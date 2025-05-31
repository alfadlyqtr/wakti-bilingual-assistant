
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ELEVENLABS_API_KEY = "sk_7b19e76d94655f74d81063f3dd7b39cf9460ea743d40a532";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { text, voice_id } = await req.json();

    if (!text || !voice_id) {
      throw new Error('Text and voice_id are required');
    }

    console.log('Generating TTS for user:', user.id);
    console.log('Voice ID:', voice_id);
    console.log('Text length:', text.length);

    // Check character usage
    const { data: usage, error: usageError } = await supabase
      .from('user_voice_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (usageError) {
      console.error('Failed to check character usage:', usageError);
      throw new Error('Failed to check character usage');
    }

    const remainingChars = usage.characters_limit - usage.characters_used;
    if (text.length > remainingChars) {
      throw new Error(`Not enough characters remaining. You have ${remainingChars} characters left.`);
    }

    console.log('Making request to ElevenLabs API...');

    // Call ElevenLabs TTS API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    console.log('ElevenLabs API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS API error:', errorText);
      throw new Error(`Failed to generate speech: ${errorText}`);
    }

    // Get audio data as arrayBuffer
    console.log('Converting audio response to array buffer...');
    const audioBuffer = await response.arrayBuffer();
    console.log('Audio buffer size:', audioBuffer.byteLength);

    // Convert to base64 for frontend consumption
    const audioArray = new Uint8Array(audioBuffer);
    const base64Audio = btoa(String.fromCharCode(...audioArray));
    console.log('Base64 audio length:', base64Audio.length);

    // Update character usage
    const { error: updateError } = await supabase
      .from('user_voice_usage')
      .update({
        characters_used: usage.characters_used + text.length,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update character usage:', updateError);
    } else {
      console.log('Character usage updated successfully');
    }

    // Return base64 encoded audio
    return new Response(
      JSON.stringify({ 
        success: true, 
        audioData: base64Audio,
        contentType: 'audio/mpeg'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in voice-tts function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        success: false
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
