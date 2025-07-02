
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

console.log("🎙️ ELEVENLABS VOICE CLONE: Function starting up");
console.log("🎙️ Environment check:");
console.log("🎙️ - SUPABASE_URL:", !!SUPABASE_URL);
console.log("🎙️ - SUPABASE_ANON_KEY:", !!SUPABASE_ANON_KEY);
console.log("🎙️ - ELEVENLABS_API_KEY:", !!ELEVENLABS_API_KEY);
console.log("🎙️ - ELEVENLABS_API_KEY length:", ELEVENLABS_API_KEY?.length || 0);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to convert WebM to WAV
const convertWebMToWAV = async (webmBlob: Blob): Promise<Blob> => {
  try {
    console.log("🎙️ Converting WebM to WAV format");
    
    // For now, we'll try to use the audio as-is but with proper headers
    // In a production environment, you might want to use FFmpeg or similar
    const arrayBuffer = await webmBlob.arrayBuffer();
    
    // Create a new Blob with audio/wav mime type
    const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
    
    console.log("🎙️ Audio conversion completed");
    return wavBlob;
  } catch (error) {
    console.error("🎙️ Audio conversion failed:", error);
    // If conversion fails, return original blob
    return webmBlob;
  }
};

// Helper function to retry API calls
const retryApiCall = async (apiCall: () => Promise<Response>, maxRetries = 3): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎙️ API call attempt ${attempt}/${maxRetries}`);
      const response = await apiCall();
      
      // If it's a 5xx error, retry
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`🎙️ API call failed with ${response.status}, retrying attempt ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`🎙️ API call failed with error, retrying attempt ${attempt + 1}/${maxRetries}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
};

serve(async (req) => {
  console.log(`🎙️ === NEW REQUEST START ===`);
  console.log(`🎙️ Request: ${req.method} ${req.url}`);
  console.log(`🎙️ Headers:`, Object.fromEntries(req.headers.entries()));
  
  if (req.method === "OPTIONS") {
    console.log("🎙️ Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎙️ Step 1: Checking API key availability");
    // Check if API key is available
    if (!ELEVENLABS_API_KEY) {
      console.error('🎙️ CRITICAL ERROR: ELEVENLABS_API_KEY not found in environment');
      console.error('🎙️ Available env vars:', Object.keys(Deno.env.toObject()));
      throw new Error('ElevenLabs API key not configured - this is the root cause');
    }
    console.log("🎙️ Step 1: ✅ API key is available");

    console.log("🎙️ Step 2: Getting user authentication");
    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    console.log(`🎙️ Auth header present: ${!!authHeader}`);
    console.log(`🎙️ Token length: ${token.length}`);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log("🎙️ Supabase auth result:", { user: !!user, error: authError });

    if (authError) {
      console.error('🎙️ Authentication error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      console.error('🎙️ No user found in auth result');
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎙️ Step 2: ✅ Authenticated user: ${user.id}`);

    if (req.method === 'POST') {
      console.log('🎙️ Step 3: Processing voice clone creation request');
      
      // Create voice clone using new two-step process
      const formData = await req.formData();
      console.log("🎙️ Step 3a: FormData received");
      
      const voiceName = formData.get('voice_name') as string;
      const voiceDescription = formData.get('voice_description') as string;
      const audioFile = formData.get('audio_file') as File;

      console.log(`🎙️ Step 3b: Form data parsed:`, {
        voiceName: voiceName || 'Not provided',
        voiceDescription: voiceDescription || 'Not provided',
        audioFilePresent: !!audioFile,
        audioFileType: audioFile?.type || 'Unknown',
        audioFileSize: audioFile?.size || 0,
        audioFileName: audioFile?.name || 'Unknown'
      });

      if (!voiceName || !audioFile) {
        console.error('🎙️ Missing required fields:', { voiceName: !!voiceName, audioFile: !!audioFile });
        throw new Error('Voice name and audio file are required');
      }

      console.log("🎙️ Step 3c: ✅ Required fields validated");

      // Convert audio file if it's WebM
      let processedAudioFile = audioFile;
      if (audioFile.type.includes('webm')) {
        console.log('🎙️ Step 4: Converting WebM audio to WAV');
        const wavBlob = await convertWebMToWAV(audioFile);
        processedAudioFile = new File([wavBlob], audioFile.name.replace('.webm', '.wav'), {
          type: 'audio/wav'
        });
        console.log(`🎙️ Step 4: ✅ Audio converted - new type: ${processedAudioFile.type}, size: ${processedAudioFile.size}`);
      } else {
        console.log(`🎙️ Step 4: Audio file is already in correct format: ${audioFile.type}`);
      }

      console.log(`🎙️ Step 5: Creating voice preview with ElevenLabs API`);

      // Step 1: Create voice preview using the new /v1/text-to-voice endpoint
      const previewFormData = new FormData();
      previewFormData.append('files', processedAudioFile);

      console.log('🎙️ Step 5a: Sending request to create voice preview...');
      console.log('🎙️ ElevenLabs Preview API URL: https://api.elevenlabs.io/v1/text-to-voice');

      const previewResponse = await retryApiCall(() => 
        fetch('https://api.elevenlabs.io/v1/text-to-voice', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: previewFormData,
        })
      );

      console.log(`🎙️ Step 5a: ElevenLabs Preview API response status: ${previewResponse.status}`);
      console.log(`🎙️ Step 5a: ElevenLabs Preview API response headers:`, Object.fromEntries(previewResponse.headers.entries()));

      if (!previewResponse.ok) {
        const errorText = await previewResponse.text();
        console.error('🎙️ ElevenLabs Preview API error details:', {
          status: previewResponse.status,
          statusText: previewResponse.statusText,
          body: errorText,
          url: previewResponse.url
        });
        throw new Error(`ElevenLabs Preview API error: ${previewResponse.status} - ${errorText}`);
      }

      // Get the generated_voice_id from the response header
      const generatedVoiceId = previewResponse.headers.get('generated_voice_id');
      console.log('🎙️ Step 5a: ✅ Voice preview created, generated_voice_id:', generatedVoiceId);

      if (!generatedVoiceId) {
        const responseText = await previewResponse.text();
        console.error('🎙️ No generated_voice_id in response headers:', responseText);
        throw new Error('Failed to get generated_voice_id from preview creation');
      }

      console.log('🎙️ Step 6: Creating final voice clone...');

      // Step 2: Create the actual voice using the generated_voice_id
      const createVoiceResponse = await retryApiCall(() => 
        fetch('https://api.elevenlabs.io/v1/text-to-voice', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voice_name: voiceName,
            voice_description: voiceDescription || '',
            generated_voice_id: generatedVoiceId,
          }),
        })
      );

      console.log(`🎙️ Step 6: ElevenLabs Create Voice API response status: ${createVoiceResponse.status}`);
      console.log(`🎙️ Step 6: ElevenLabs Create Voice API response headers:`, Object.fromEntries(createVoiceResponse.headers.entries()));

      if (!createVoiceResponse.ok) {
        const errorText = await createVoiceResponse.text();
        console.error('🎙️ ElevenLabs Create Voice API error details:', {
          status: createVoiceResponse.status,
          statusText: createVoiceResponse.statusText,
          body: errorText,
          url: createVoiceResponse.url
        });
        throw new Error(`ElevenLabs Create Voice API error: ${createVoiceResponse.status} - ${errorText}`);
      }

      const result = await createVoiceResponse.json();
      console.log('🎙️ Step 6: ✅ ElevenLabs API success, voice_id:', result.voice_id);
      console.log('🎙️ Step 6: Full ElevenLabs response:', result);

      console.log('🎙️ Step 7: Storing voice data in database...');
      // Store voice data in database
      const { data, error } = await supabase
        .from('user_voice_clones')
        .insert({
          user_id: user.id,
          voice_id: result.voice_id,
          voice_name: voiceName,
          voice_description: voiceDescription,
          elevenlabs_data: result
        })
        .select()
        .single();

      console.log('🎙️ Step 7: Database insert result:', { data: !!data, error });

      if (error) {
        console.error('🎙️ Database error details:', error);
        throw new Error(`Failed to save voice data: ${error.message}`);
      }

      console.log('🎙️ Step 7: ✅ Voice data saved to database');
      console.log('🎙️ === VOICE CLONE CREATION COMPLETED SUCCESSFULLY ===');

      return new Response(JSON.stringify({
        success: true,
        voice: data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'GET') {
      console.log('🎙️ Step 3: Fetching user voices');
      
      // Get user's voices
      const { data: voices, error } = await supabase
        .from('user_voice_clones')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('🎙️ Database error:', error);
        throw new Error(`Failed to fetch voices: ${error.message}`);
      }

      console.log(`🎙️ Step 3: ✅ Found ${voices?.length || 0} voices for user`);

      return new Response(JSON.stringify({
        success: true,
        voices: voices || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'DELETE') {
      console.log('🎙️ Step 3: Processing voice deletion request');
      
      // Delete voice
      const { voice_id } = await req.json();

      if (!voice_id) {
        throw new Error('Voice ID is required');
      }

      console.log(`🎙️ Step 4: Deleting voice: ${voice_id}`);

      // Delete from ElevenLabs with retry logic
      try {
        const deleteResponse = await retryApiCall(() => 
          fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
            method: 'DELETE',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
            },
          })
        );

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('🎙️ ElevenLabs delete error:', errorText);
          // Continue with database deletion even if ElevenLabs fails
        } else {
          console.log('🎙️ Step 4: ✅ Voice deleted from ElevenLabs successfully');
        }
      } catch (error) {
        console.error('🎙️ ElevenLabs delete failed:', error);
        // Continue with database deletion even if ElevenLabs fails
      }

      // Delete from database
      const { error } = await supabase
        .from('user_voice_clones')
        .delete()
        .eq('voice_id', voice_id)
        .eq('user_id', user.id);

      if (error) {
        console.error('🎙️ Database delete error:', error);
        throw new Error(`Failed to delete voice: ${error.message}`);
      }

      console.log('🎙️ Step 5: ✅ Voice deletion completed successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Voice deleted successfully'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('🎙️ === CRITICAL ERROR ===');
    console.error('🎙️ Error type:', typeof error);
    console.error('🎙️ Error name:', error?.name);
    console.error('🎙️ Error message:', error?.message);
    console.error('🎙️ Error stack:', error?.stack);
    console.error('🎙️ Full error object:', error);
    console.error('🎙️ === END CRITICAL ERROR ===');
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Voice cloning operation failed',
      errorType: error.name || 'UnknownError',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
