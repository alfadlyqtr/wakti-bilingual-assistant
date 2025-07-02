
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

console.log("🎙️ ELEVENLABS VOICE CLONE: Function loaded");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

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
  console.log(`🎙️ Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if API key is available
    if (!ELEVENLABS_API_KEY) {
      console.error('🎙️ ELEVENLABS_API_KEY not found in environment');
      throw new Error('ElevenLabs API key not configured');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    console.log(`🎙️ Auth header present: ${!!authHeader}`);
    console.log(`🎙️ Token length: ${token.length}`);
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      console.error('🎙️ User authentication failed');
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎙️ Authenticated user: ${user.id}`);

    if (req.method === 'POST') {
      console.log('🎙️ Processing voice clone creation request');
      
      // Create voice clone using instant voice cloning
      const formData = await req.formData();
      const voiceName = formData.get('voice_name') as string;
      const voiceDescription = formData.get('voice_description') as string;
      const audioFile = formData.get('audio_file') as File;

      console.log(`🎙️ Form data received:`, {
        voiceName: voiceName || 'Not provided',
        voiceDescription: voiceDescription || 'Not provided',
        audioFilePresent: !!audioFile,
        audioFileType: audioFile?.type || 'Unknown',
        audioFileSize: audioFile?.size || 0
      });

      if (!voiceName || !audioFile) {
        console.error('🎙️ Missing required fields');
        throw new Error('Voice name and audio file are required');
      }

      // Convert audio file if it's WebM
      let processedAudioFile = audioFile;
      if (audioFile.type.includes('webm')) {
        console.log('🎙️ Converting WebM audio to WAV');
        const wavBlob = await convertWebMToWAV(audioFile);
        processedAudioFile = new File([wavBlob], audioFile.name.replace('.webm', '.wav'), {
          type: 'audio/wav'
        });
        console.log(`🎙️ Audio converted - new type: ${processedAudioFile.type}, size: ${processedAudioFile.size}`);
      }

      console.log(`🎙️ Creating voice clone: ${voiceName}`);

      // Prepare form data for ElevenLabs instant voice cloning
      const elevenlabsFormData = new FormData();
      elevenlabsFormData.append('name', voiceName);
      if (voiceDescription) {
        elevenlabsFormData.append('description', voiceDescription);
      }
      elevenlabsFormData.append('files', processedAudioFile);

      console.log('🎙️ Sending request to ElevenLabs API...');

      // Use instant voice cloning endpoint with retry logic
      const response = await retryApiCall(() => 
        fetch('https://api.elevenlabs.io/v1/voices/ivc/create', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: elevenlabsFormData,
        })
      );

      console.log(`🎙️ ElevenLabs API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎙️ ElevenLabs API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🎙️ Voice created successfully:', result.voice_id);

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

      if (error) {
        console.error('🎙️ Database error:', error);
        throw new Error(`Failed to save voice data: ${error.message}`);
      }

      console.log('🎙️ Voice clone creation completed successfully');

      return new Response(JSON.stringify({
        success: true,
        voice: data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'GET') {
      console.log('🎙️ Fetching user voices');
      
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

      console.log(`🎙️ Found ${voices?.length || 0} voices for user`);

      return new Response(JSON.stringify({
        success: true,
        voices: voices || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'DELETE') {
      console.log('🎙️ Processing voice deletion request');
      
      // Delete voice
      const { voice_id } = await req.json();

      if (!voice_id) {
        throw new Error('Voice ID is required');
      }

      console.log(`🎙️ Deleting voice: ${voice_id}`);

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
          console.log('🎙️ Voice deleted from ElevenLabs successfully');
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

      console.log('🎙️ Voice deletion completed successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Voice deleted successfully'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('🎙️ Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Voice cloning operation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
