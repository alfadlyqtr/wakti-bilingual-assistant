
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
const ELEVEN_LABS_API_KEY = Deno.env.get('ELEVEN_LABS_API_KEY');

console.log("🎙️ VOICE CLONE: Function loaded");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVEN_LABS_API_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req) => {
  console.log(`🎙️ Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if API key is available
    if (!ELEVEN_LABS_API_KEY) {
      console.error('🎙️ ELEVEN_LABS_API_KEY not found in environment');
      throw new Error('Voice service API key not configured');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎙️ Authenticated user: ${user.id}`);

    // Handle DELETE request (voice deletion)
    if (req.method === 'DELETE') {
      const requestBody = await req.json();
      const { voice_id, action } = requestBody;
      
      console.log(`🗑️ Delete request received:`, { voice_id, action, user_id: user.id });
      
      if (action !== 'delete' || !voice_id) {
        console.error('🗑️ Invalid delete request parameters');
        throw new Error('Invalid delete request - missing voice_id or action');
      }

      console.log(`🗑️ Starting deletion process for voice: ${voice_id}`);

      // Step 1: Delete from ElevenLabs first
      let elevenLabsSuccess = false;
      let elevenLabsError = null;

      try {
        console.log(`🗑️ Deleting voice from ElevenLabs: ${voice_id}`);
        
        const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
          method: 'DELETE',
          headers: {
            'xi-api-key': ELEVEN_LABS_API_KEY,
          },
        });

        console.log(`🗑️ ElevenLabs delete response status: ${deleteResponse.status}`);

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();
          console.log('🗑️ ElevenLabs delete result:', result);
          
          if (result.status === 'ok') {
            elevenLabsSuccess = true;
            console.log('🗑️ Successfully deleted voice from ElevenLabs');
          } else {
            throw new Error(`ElevenLabs delete failed: ${JSON.stringify(result)}`);
          }
        } else {
          const errorText = await deleteResponse.text();
          throw new Error(`ElevenLabs API error ${deleteResponse.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('🗑️ ElevenLabs deletion failed:', error);
        elevenLabsError = error.message;
      }

      // Step 2: Delete from database
      let dbSuccess = false;
      let dbError = null;

      try {
        console.log(`🗑️ Deleting voice from database: ${voice_id}`);
        
        const { error: dbDeleteErr } = await supabase
          .from('user_voice_clones')
          .delete()
          .eq('voice_id', voice_id)
          .eq('user_id', user.id);

        if (dbDeleteErr) {
          throw new Error(`Database delete error: ${dbDeleteErr.message}`);
        } else {
          dbSuccess = true;
          console.log('🗑️ Successfully deleted voice from database');
        }
      } catch (error) {
        console.error('🗑️ Database deletion failed:', error);
        dbError = error.message;
      }

      // Determine overall success
      if (elevenLabsSuccess && dbSuccess) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Voice deleted successfully from both ElevenLabs and database'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else if (elevenLabsSuccess && !dbSuccess) {
        console.error('🗑️ Partial success: ElevenLabs deleted but database failed');
        return new Response(JSON.stringify({
          success: false,
          error: `Voice deleted from ElevenLabs but database cleanup failed: ${dbError}`
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else if (!elevenLabsSuccess && dbSuccess) {
        console.error('🗑️ Partial success: Database deleted but ElevenLabs failed');
        return new Response(JSON.stringify({
          success: false,
          error: `Voice deleted from database but ElevenLabs deletion failed: ${elevenLabsError}`
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else {
        console.error('🗑️ Complete failure: Both deletions failed');
        return new Response(JSON.stringify({
          success: false,
          error: `Both deletions failed. ElevenLabs: ${elevenLabsError}, Database: ${dbError}`
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle voice cloning (POST request)
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;
    const voiceDescription = formData.get('voiceDescription') as string || 'Voice cloned via WAKTI';
    
    console.log(`🎙️ Voice cloning request:`, {
      hasAudioFile: !!audioFile,
      audioSize: audioFile?.size,
      audioType: audioFile?.type,
      voiceName: voiceName,
      voiceDescription: voiceDescription
    });

    if (!audioFile || !voiceName) {
      throw new Error('Missing required fields: audio file and voice name are required');
    }

    if (voiceDescription.length < 20 || voiceDescription.length > 1000) {
      throw new Error('Voice description must be between 20 and 1000 characters');
    }

    // Check user's voice limit
    const { data: existingVoices, error: countError } = await supabase
      .from('user_voice_clones')
      .select('id')
      .eq('user_id', user.id);

    if (countError) {
      console.error('🎙️ Error checking voice count:', countError);
      throw new Error('Failed to check existing voice count');
    }

    if (existingVoices && existingVoices.length >= 3) {
      throw new Error('Voice limit reached. You can have maximum 3 voice clones. Please delete an existing voice first.');
    }

    console.log(`🎙️ Starting voice cloning process...`);

    // Create FormData for ElevenLabs voice creation API with correct field names
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', voiceName);
    elevenLabsFormData.append('description', voiceDescription);
    elevenLabsFormData.append('files', audioFile); // Note: ElevenLabs expects 'files' not 'files[]'
    elevenLabsFormData.append('remove_background_noise', 'false');

    console.log(`🎙️ Calling ElevenLabs voice creation API...`);
    console.log(`🎙️ FormData entries:`, {
      name: voiceName,
      description: voiceDescription,
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      remove_background_noise: 'false'
    });
    
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
      body: elevenLabsFormData,
    });

    console.log(`🎙️ ElevenLabs API response status: ${elevenLabsResponse.status}`);

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('🎙️ ElevenLabs API error:', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        error: errorText
      });
      throw new Error(`Voice cloning failed (${elevenLabsResponse.status}): ${errorText}`);
    }

    const result = await elevenLabsResponse.json();
    console.log('🎙️ Voice cloning result:', {
      voiceId: result.voice_id,
      voiceName: result.name,
      fullResult: result
    });

    if (!result.voice_id) {
      console.error('🎙️ No voice_id in response:', result);
      throw new Error('No voice ID received from ElevenLabs voice cloning service');
    }

    // Save to database
    console.log(`🎙️ Saving voice clone to database...`);
    const { data: dbResult, error: dbError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_id: user.id,
        voice_id: result.voice_id,
        voice_name: voiceName,
        voice_description: voiceDescription,
        elevenlabs_data: {
          ...result,
          created_via: 'WAKTI',
          audio_file_size: audioFile.size,
          audio_file_type: audioFile.type
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('🎙️ Database insert error:', dbError);
      
      // Cleanup: Try to delete the voice from ElevenLabs since DB save failed
      try {
        console.log('🎙️ Cleaning up voice from ElevenLabs after DB error...');
        await fetch(`https://api.elevenlabs.io/v1/voices/${result.voice_id}`, {
          method: 'DELETE',
          headers: {
            'xi-api-key': ELEVEN_LABS_API_KEY,
          },
        });
        console.log('🎙️ Cleanup successful');
      } catch (cleanupError) {
        console.error('🎙️ Failed to cleanup voice after DB error:', cleanupError);
      }
      
      throw new Error('Failed to save voice clone to database');
    }

    console.log('🎙️ Voice clone saved successfully:', dbResult);

    return new Response(JSON.stringify({
      success: true,
      voice_id: result.voice_id,
      voice_name: voiceName,
      message: 'Voice cloned successfully',
      data: dbResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🎙️ Voice clone error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Voice cloning failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
