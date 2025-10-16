
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

console.log('Edge Function: transcribe-audio initializing');

serve(async (req) => {
  // Log every single request with details
  const url = new URL(req.url);
  console.log(`[${new Date().toISOString()}] Request received:`, {
    method: req.method,
    url: req.url,
    path: url.pathname,
    origin: req.headers.get('origin'),
    contentType: req.headers.get('content-type')
  });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
      hasOpenAIKey: !!openaiApiKey,
      supabaseUrlStart: supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : null
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      const error = 'Missing Supabase credentials';
      console.error(error);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error', 
          details: error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openaiApiKey) {
      const error = 'Missing OpenAI API key';
      console.error(error);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error', 
          details: error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log request size and content type
    const contentLength = req.headers.get('content-length');
    console.log('Request content details:', {
      contentLength: contentLength,
      contentType: req.headers.get('content-type')
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', {
        hasAudioUrl: !!requestBody.audioUrl,
        audioUrlType: typeof requestBody.audioUrl,
        audioUrlLength: requestBody.audioUrl ? requestBody.audioUrl.length : 0,
        audioUrlPreview: requestBody.audioUrl ? `${requestBody.audioUrl.substring(0, 20)}...` : null
      });
    } catch (error) {
      console.error('Failed to parse request JSON:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request format', 
          details: 'Could not parse JSON body',
          parseError: error.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the audio file URL and optional language hint from the request body
    const { audioUrl, language: languageHint } = requestBody as { audioUrl?: string; language?: string };
    // Defensive sanitize: decode URL-encoded spaces, trim whitespace, and validate
    let cleanedAudioUrl = (typeof audioUrl === 'string' ? audioUrl : '').trim();
    // Decode any URL-encoded characters (like %20 for space) and trim again
    try {
      cleanedAudioUrl = decodeURIComponent(cleanedAudioUrl).trim();
    } catch (e) {
      // If decoding fails, continue with the trimmed version
      console.log('Could not decode URL, using trimmed version:', cleanedAudioUrl);
    }

    if (!cleanedAudioUrl) {
      console.error('Missing audioUrl in request');
      return new Response(
        JSON.stringify({ error: 'Audio URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing audio URL:', cleanedAudioUrl.substring(0, 30) + '...', 'languageHint:', languageHint || 'none');

    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client created');

    // Extract the path from the storage URL
    let filePath = '';
    try {
      // Format: https://[project-ref].supabase.co/storage/v1/object/public/tasjeel_recordings/[user-id]/[filename].webm
      const storageUrl = new URL(cleanedAudioUrl);
      console.log('Storage URL parsed:', storageUrl.toString());
      console.log('Storage pathname:', storageUrl.pathname);
      
      const pathParts = storageUrl.pathname.split('/');
      console.log('Path parts:', pathParts);
      
      // Find the index of "public" and get everything after it
      const publicIndex = pathParts.indexOf('public');
      
      if (publicIndex === -1) {
        throw new Error('Invalid storage URL format - missing "public" path segment');
      }
      
      // Filter out empty strings and get the path after "public/"
      filePath = pathParts.filter(Boolean).slice(publicIndex + 1).join('/');
      console.log('Extracted file path:', filePath);
    } catch (error) {
      console.error('Error parsing audio URL:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid audio URL format', 
          details: error.message,
          audioUrl: cleanedAudioUrl
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the consistent bucket ID "tasjeel_recordings"
    const bucketId = "tasjeel_recordings";
    console.log(`Checking if bucket exists: ${bucketId}`);
    
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .getBucket(bucketId);
    
    if (bucketError) {
      console.error('Error checking bucket:', bucketError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to access storage bucket', 
          details: bucketError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Bucket exists:', bucketData);

    // Get the audio file from storage using the consistent bucket ID
    console.log(`Downloading from bucket "${bucketId}", path:`, filePath);
    const { data: audioData, error: audioError } = await supabase.storage
      .from(bucketId)
      .download(filePath);

    if (audioError) {
      console.error('Error downloading audio:', audioError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to access audio file', 
          details: audioError,
          path: filePath
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!audioData) {
      console.error('No audio data found');
      return new Response(
        JSON.stringify({ 
          error: 'No audio data found',
          path: filePath 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Audio file downloaded, size:', audioData.size);

    // Convert the audio data to a form that can be sent to OpenAI (GPT-4o transcribe)
    const formData = new FormData();
    // Keep filename and content-type explicit for best format detection
    const audioBlob = new Blob([audioData], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    // Use GPT-4o transcribe for better multilingual code-switching (AR/EN and mixed).
    formData.append('model', 'gpt-4o-transcribe');
    // Optional language hint (e.g., 'ar' or 'en')
    if (typeof languageHint === 'string' && (languageHint === 'ar' || languageHint === 'en')) {
      formData.append('language', languageHint);
    }

    console.log('FormData ready, sending to OpenAI GPT-4o Mini Transcribe');
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    console.log('OpenAI response received, status:', openaiResponse.status);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Transcription failed', 
          details: `Status: ${openaiResponse.status}, Message: ${errorText}`
        }),
        { status: openaiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription = await openaiResponse.json();
    console.log('Transcription received:', transcription.text ? 'Success' : 'Empty');

    return new Response(
      JSON.stringify({ transcript: transcription.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unhandled error in transcription function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Transcription failed', 
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
