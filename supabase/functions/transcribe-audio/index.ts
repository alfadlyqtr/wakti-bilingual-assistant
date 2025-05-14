
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get supabase client with service role
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), 
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Create Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { recordingId } = await req.json();

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

    // Get the audio file from storage
    const audioPath = recording.recording_url.replace(`${supabaseUrl}/storage/v1/object/public/`, '');
    
    // Get public URL of the file
    const { data: audioData } = await supabase.storage
      .from(audioPath.split('/')[0])
      .createSignedUrl(audioPath.split('/').slice(1).join('/'), 60);

    if (!audioData?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Could not access audio file' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download the audio file
    const audioResponse = await fetch(audioData.signedUrl);
    const audioBlob = await audioResponse.blob();

    // Prepare form data for OpenAI
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "whisper-1");

    // Send to OpenAI Whisper
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI API error: ${errorText}` }), 
        { status: whisperResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const whisperData = await whisperResponse.json();
    
    // Update the voice summary record with transcription
    const { error: updateError } = await supabase
      .from('voice_summaries')
      .update({ 
        transcription_text: whisperData.text,
        transcription_status: 'completed'
      })
      .eq('id', recordingId);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update transcription in database' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: whisperData.text 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
