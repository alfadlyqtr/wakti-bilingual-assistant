
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-user-agent, accept, accept-language, cache-control, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVEN_LABS_API_KEY = Deno.env.get('ELEVEN_LABS_API_KEY');

console.log("🎙️ VOICE CLONE: Function loaded");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVEN_LABS_API_KEY);
console.log("🎙️ Supabase URL:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function logRequestDetails(req: Request) {
  console.log(`🎙️ === REQUEST DETAILS ===`);
  console.log(`🎙️ Method: ${req.method}`);
  console.log(`🎙️ URL: ${req.url}`);
  console.log(`🎙️ Headers:`);
  for (const [key, value] of req.headers.entries()) {
    console.log(`🎙️   ${key}: ${value}`);
  }
}

function logFormDataDetails(formData: FormData) {
  console.log(`🎙️ === FORMDATA DETAILS ===`);
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      console.log(`🎙️ FormData[${key}]: File {`);
      console.log(`🎙️   name: ${value.name}`);
      console.log(`🎙️   size: ${value.size} bytes`);
      console.log(`🎙️   type: ${value.type}`);
      console.log(`🎙️ }`);
    } else {
      console.log(`🎙️ FormData[${key}]: ${value}`);
    }
  }
}

serve(async (req) => {
  const startTime = Date.now();
  console.log(`🎙️ === NEW REQUEST START (${new Date().toISOString()}) ===`);
  
  logRequestDetails(req);
  
  if (req.method === "OPTIONS") {
    console.log(`🎙️ Handling OPTIONS preflight request`);
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Check if API key is available
    if (!ELEVEN_LABS_API_KEY) {
      console.error('🎙️ ELEVEN_LABS_API_KEY not found in environment');
      return new Response(JSON.stringify({
        success: false,
        error: 'Voice service API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    console.log(`🎙️ Auth header available: ${!!authHeader}`);
    console.log(`🎙️ Token length: ${token.length}`);
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      console.error('🎙️ User authentication failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - user not authenticated'
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`🎙️ Authenticated user: ${user.id}`);

    // Handle DELETE request (voice deletion)
    if (req.method === 'DELETE') {
      const requestBody = await req.json();
      console.log(`🗑️ Delete request body:`, requestBody);
      
      const { voice_id, action } = requestBody;
      
      if (action !== 'delete' || !voice_id) {
        console.error('🗑️ Invalid delete request parameters');
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid delete request - missing voice_id or action'
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log(`🗑️ Starting deletion process for voice: ${voice_id}`);

      // Step 1: Get voice record to find audio file URL
      const { data: voiceRecord, error: fetchError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .eq('voice_id', voice_id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('🗑️ Error fetching voice record:', fetchError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Voice not found in database'
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Step 2: Delete from ElevenLabs
      const deleteUrl = `https://api.elevenlabs.io/v1/voices/${voice_id}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'xi-api-key': ELEVEN_LABS_API_KEY,
        },
      });

      const deleteResponseText = await deleteResponse.text();
      console.log(`🗑️ ElevenLabs delete response: ${deleteResponse.status} - ${deleteResponseText}`);

      let elevenLabsSuccess = false;
      if (deleteResponse.ok) {
        try {
          const deleteData = JSON.parse(deleteResponseText);
          if (deleteData && deleteData.status === 'ok') {
            elevenLabsSuccess = true;
            console.log('🗑️ Successfully deleted voice from ElevenLabs');
          }
        } catch (e) {
          if (deleteResponse.status === 200) {
            elevenLabsSuccess = true;
            console.log('🗑️ Successfully deleted voice from ElevenLabs (empty response)');
          }
        }
      }

      // Step 3: Delete audio file from storage if it exists
      if (voiceRecord.audio_file_url) {
        try {
          // Extract file path from URL
          const urlParts = voiceRecord.audio_file_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `${user.id}/${fileName}`;
          
          console.log(`🗑️ Deleting audio file: ${filePath}`);
          
          const { error: storageError } = await supabaseAdmin.storage
            .from('voice-recordings')
            .remove([filePath]);

          if (storageError) {
            console.error('🗑️ Error deleting audio file:', storageError);
          } else {
            console.log('🗑️ Successfully deleted audio file from storage');
          }
        } catch (error) {
          console.error('🗑️ Error processing audio file deletion:', error);
        }
      }

      // Step 4: Delete from database
      const { error: dbError } = await supabase
        .from('user_voice_clones')
        .delete()
        .eq('voice_id', voice_id)
        .eq('user_id', user.id);

      const processingTime = Date.now() - startTime;

      if (dbError) {
        console.error('🗑️ Database delete error:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: `Database deletion failed: ${dbError.message}`,
          processingTime
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log(`🗑️ Delete operation completed in ${processingTime}ms`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Voice deleted successfully',
        processingTime
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle voice cloning (POST request) - NEW SIMPLE FLOW
    console.log(`🎙️ Processing voice cloning request - SIMPLE FLOW`);
    
    const formData = await req.formData();
    logFormDataDetails(formData);
    
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;
    const voiceDescription = formData.get('voiceDescription') as string || 'Voice cloned via WAKTI';
    
    console.log(`🎙️ Voice cloning parameters:`, {
      hasAudioFile: !!audioFile,
      audioSize: audioFile?.size,
      audioType: audioFile?.type,
      voiceName: voiceName,
      voiceDescriptionLength: voiceDescription?.length
    });

    // Validate required fields
    if (!audioFile || !voiceName) {
      console.error('🎙️ Missing required fields');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: audio file and voice name are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (voiceDescription.length < 20 || voiceDescription.length > 1000) {
      console.error('🎙️ Invalid voice description length:', voiceDescription.length);
      return new Response(JSON.stringify({
        success: false,
        error: 'Voice description must be between 20 and 1000 characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check user's voice limit
    const { data: existingVoices, error: countError } = await supabase
      .from('user_voice_clones')
      .select('id')
      .eq('user_id', user.id);

    if (countError) {
      console.error('🎙️ Error checking voice count:', countError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to check existing voice count'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (existingVoices && existingVoices.length >= 3) {
      console.error('🎙️ Voice limit reached:', existingVoices.length);
      return new Response(JSON.stringify({
        success: false,
        error: 'Voice limit reached. You can have maximum 3 voice clones. Please delete an existing voice first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`🎙️ === STARTING SIMPLE FLOW ===`);
    console.log(`🎙️ Step 1: Recording completed ✓`);

    // STEP 2: SAVE TO STORAGE
    console.log(`🎙️ Step 2: Saving audio to storage...`);
    
    const fileName = `voice-${Date.now()}-${Math.random().toString(36).substring(7)}.wav`;
    const filePath = `${user.id}/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('voice-recordings')
      .upload(filePath, audioFile, {
        contentType: audioFile.type || 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      console.error('🎙️ Storage upload error:', uploadError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to save audio file: ${uploadError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`🎙️ Step 2: Audio saved to storage ✓ - Path: ${uploadData.path}`);

    // Get the file URL for storage in database
    const { data: urlData } = supabaseAdmin.storage
      .from('voice-recordings')
      .getPublicUrl(filePath);

    const audioFileUrl = urlData.publicUrl;
    console.log(`🎙️ Audio file URL: ${audioFileUrl}`);

    // STEP 3: SEND TO ELEVENLABS
    console.log(`🎙️ Step 3: Sending to ElevenLabs...`);

    // Download the file from storage to send to ElevenLabs
    const { data: audioBuffer, error: downloadError } = await supabaseAdmin.storage
      .from('voice-recordings')
      .download(filePath);

    if (downloadError) {
      console.error('🎙️ Error downloading audio from storage:', downloadError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to retrieve saved audio file'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Create FormData for ElevenLabs
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', voiceName);
    elevenLabsFormData.append('description', voiceDescription);
    elevenLabsFormData.append('files', new File([audioBuffer], fileName, { type: 'audio/wav' }));
    elevenLabsFormData.append('remove_background_noise', 'true');

    const cloneUrl = 'https://api.elevenlabs.io/v1/voices/add';
    const cloneResponse = await fetch(cloneUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
      body: elevenLabsFormData,
    });

    const cloneResponseText = await cloneResponse.text();
    console.log(`🎙️ ElevenLabs response: ${cloneResponse.status} - ${cloneResponseText}`);

    if (!cloneResponse.ok) {
      console.error('🎙️ ElevenLabs API error during cloning');
      // Clean up storage file on failure
      await supabaseAdmin.storage.from('voice-recordings').remove([filePath]);
      
      return new Response(JSON.stringify({
        success: false,
        error: `Voice cloning failed (${cloneResponse.status}): ${cloneResponseText}`
      }), {
        status: cloneResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let cloneData;
    try {
      cloneData = JSON.parse(cloneResponseText);
    } catch (e) {
      console.error('🎙️ Failed to parse ElevenLabs response:', e);
      // Clean up storage file on failure
      await supabaseAdmin.storage.from('voice-recordings').remove([filePath]);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid response from voice cloning service'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!cloneData || !cloneData.voice_id) {
      console.error('🎙️ No voice_id in response:', cloneData);
      // Clean up storage file on failure
      await supabaseAdmin.storage.from('voice-recordings').remove([filePath]);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'No voice ID received from ElevenLabs voice cloning service'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`🎙️ Step 3: Voice cloned successfully with ID: ${cloneData.voice_id} ✓`);

    // STEP 4: SAVE TO DATABASE
    console.log(`🎙️ Step 4: Saving voice clone to database...`);
    
    const { data: dbResult, error: dbError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_id: user.id,
        voice_id: cloneData.voice_id,
        voice_name: voiceName,
        voice_description: voiceDescription,
        audio_file_url: audioFileUrl,
        elevenlabs_data: {
          ...cloneData,
          created_via: 'WAKTI',
          audio_file_size: audioFile.size,
          audio_file_type: audioFile.type,
          storage_path: filePath
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('🎙️ Database insert error:', dbError);
      
      // Cleanup: Delete voice from ElevenLabs and storage
      try {
        console.log('🎙️ Cleaning up after DB error...');
        await fetch(`https://api.elevenlabs.io/v1/voices/${cloneData.voice_id}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': ELEVEN_LABS_API_KEY },
        });
        await supabaseAdmin.storage.from('voice-recordings').remove([filePath]);
        console.log('🎙️ Cleanup completed');
      } catch (cleanupError) {
        console.error('🎙️ Failed to cleanup after DB error:', cleanupError);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to save voice clone to database'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const processingTime = Date.now() - startTime;
    console.log(`🎙️ Step 4: Voice clone saved successfully ✓`);
    console.log(`🎙️ === SIMPLE FLOW COMPLETED in ${processingTime}ms ===`);
    console.log(`🎙️ Final result:`, dbResult);

    return new Response(JSON.stringify({
      success: true,
      voice_id: cloneData.voice_id,
      voice_name: voiceName,
      audio_file_url: audioFileUrl,
      message: 'Voice cloned successfully using simple flow: Record → Save → Send',
      data: dbResult,
      processingTime
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('🎙️ Voice clone error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Voice cloning failed',
      processingTime
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
