
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the audio file URL from the request body
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      console.error('Missing audioUrl in request');
      return new Response(
        JSON.stringify({ error: 'Audio URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing audio URL:', audioUrl);

    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract the path from the storage URL
    let filePath = '';
    try {
      // Format: https://[project-ref].supabase.co/storage/v1/object/public/tasjeel_recordings/[user-id]/[filename].webm
      const storageUrl = new URL(audioUrl);
      const pathParts = storageUrl.pathname.split('/');
      
      // Filter out empty strings and get the path after "public/"
      filePath = pathParts.filter(Boolean).slice(pathParts.indexOf('public') + 1).join('/');
      
      console.log('Extracted file path:', filePath);
    } catch (error) {
      console.error('Error parsing audio URL:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid audio URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the audio file from storage
    console.log('Downloading from bucket:', filePath);
    const { data: audioData, error: audioError } = await supabase.storage
      .from('tasjeel_recordings')
      .download(filePath);

    if (audioError) {
      console.error('Error downloading audio:', audioError);
      return new Response(
        JSON.stringify({ error: 'Failed to access audio file', details: audioError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!audioData) {
      console.error('No audio data found');
      return new Response(
        JSON.stringify({ error: 'No audio data found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Audio file downloaded, size:', audioData.size);

    // Convert the audio data to a form that can be sent to OpenAI
    const formData = new FormData();
    formData.append('file', new Blob([audioData]), 'audio.webm');
    formData.append('model', 'whisper-1');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending to OpenAI Whisper API');
    
    // Send the audio to OpenAI Whisper API
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await openaiResponse.json();
    console.log('Transcription received:', transcription.text ? 'Success' : 'Empty');

    return new Response(
      JSON.stringify({ transcript: transcription.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: 'Transcription failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
