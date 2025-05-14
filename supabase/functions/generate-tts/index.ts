
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const elevenLabsKey = Deno.env.get("ELEVEN_LABS_API_KEY");

  try {
    const { recordingId, voiceGender = "male" } = await req.json();

    if (!recordingId) {
      return new Response(JSON.stringify({ error: 'Missing recordingId' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get recording details from database
    const { data: recording, error: recordingError } = await supabase
      .from('voice_summaries')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      return new Response(JSON.stringify({ error: 'Recording not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!recording.summary_text) {
      return new Response(JSON.stringify({ error: 'Summary not available' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determine which TTS service to use
    let audioBlob;
    let contentType;
    
    // Use ElevenLabs if key is available
    if (elevenLabsKey) {
      const voiceId = voiceGender === "male" ? "onwK4e9ZLuTAKqWW03F9" : "EXAVITQu4vr4xnSDxMaL";
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey
        },
        body: JSON.stringify({
          text: recording.summary_text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${await response.text()}`);
      }

      audioBlob = await response.blob();
      contentType = 'audio/mpeg';
    } 
    // Fallback to OpenAI TTS if ElevenLabs key isn't available
    else if (openaiApiKey) {
      const voice = voiceGender === "male" ? "echo" : "alloy";
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: recording.summary_text,
          voice: voice,
          response_format: 'mp3'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS API error: ${await response.text()}`);
      }

      audioBlob = await response.blob();
      contentType = 'audio/mpeg';
    } else {
      throw new Error("No TTS service API key available");
    }

    // Convert blob to array buffer for storage
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Store the audio file in Supabase Storage
    const filePath = `voice_summaries/${recording.user_id}/${recordingId}/summary-${Date.now()}.mp3`;
    const { error: storageError } = await supabase.storage
      .from('voice_recordings')
      .upload(filePath, uint8Array, { contentType });

    if (storageError) {
      console.error("Storage error:", storageError);
      throw new Error('Failed to store audio file');
    }

    // Get public URL for the file
    const { data: publicUrlData } = await supabase.storage
      .from('voice_recordings')
      .getPublicUrl(filePath);

    // Update the database with the summary audio URL
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({ 
        summary_audio_url: publicUrlData.publicUrl,
        voice_gender: voiceGender
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: 'Failed to update audio URL in database' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl: publicUrlData.publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
