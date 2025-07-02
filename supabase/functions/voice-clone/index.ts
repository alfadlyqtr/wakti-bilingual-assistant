
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
const ELEVEN_LABS_API_KEY = Deno.env.get('ELEVEN_LABS_API_KEY');

console.log("🎙️ VOICE CLONE: Function loaded");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVEN_LABS_API_KEY);
console.log("🎙️ Supabase URL:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

function logElevenLabsRequest(url: string, method: string, headers: Record<string, string>, body?: FormData) {
  console.log(`🎙️ === ELEVENLABS API REQUEST ===`);
  console.log(`🎙️ URL: ${url}`);
  console.log(`🎙️ Method: ${method}`);
  console.log(`🎙️ Headers:`);
  for (const [key, value] of Object.entries(headers)) {
    if (key === 'xi-api-key') {
      console.log(`🎙️   ${key}: [REDACTED]`);
    } else {
      console.log(`🎙️   ${key}: ${value}`);
    }
  }
  if (body) {
    console.log(`🎙️ Body (FormData):`);
    logFormDataDetails(body);
  }
}

async function logElevenLabsResponse(response: Response, operation: string) {
  console.log(`🎙️ === ELEVENLABS API RESPONSE (${operation}) ===`);
  console.log(`🎙️ Status: ${response.status} ${response.statusText}`);
  console.log(`🎙️ Headers:`);
  for (const [key, value] of response.headers.entries()) {
    console.log(`🎙️   ${key}: ${value}`);
  }
  
  const responseText = await response.text();
  console.log(`🎙️ Response Body: ${responseText}`);
  
  try {
    const responseData = JSON.parse(responseText);
    console.log(`🎙️ Parsed Response:`, responseData);
    return { text: responseText, data: responseData };
  } catch (e) {
    console.log(`🎙️ Response is not valid JSON`);
    return { text: responseText, data: null };
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

      // Step 1: Delete from ElevenLabs first
      const deleteUrl = `https://api.elevenlabs.io/v1/voices/${voice_id}`;
      const deleteHeaders = {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      };

      logElevenLabsRequest(deleteUrl, 'DELETE', deleteHeaders);
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: deleteHeaders,
      });

      const { text: deleteResponseText, data: deleteResponseData } = await logElevenLabsResponse(deleteResponse, 'DELETE');

      let elevenLabsSuccess = false;
      let elevenLabsError = null;

      if (deleteResponse.ok) {
        if (deleteResponseData && deleteResponseData.status === 'ok') {
          elevenLabsSuccess = true;
          console.log('🗑️ Successfully deleted voice from ElevenLabs');
        } else {
          elevenLabsError = `ElevenLabs delete failed: ${deleteResponseText}`;
          console.error('🗑️', elevenLabsError);
        }
      } else {
        elevenLabsError = `ElevenLabs API error ${deleteResponse.status}: ${deleteResponseText}`;
        console.error('🗑️', elevenLabsError);
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
          dbError = `Database delete error: ${dbDeleteErr.message}`;
          console.error('🗑️', dbError);
        } else {
          dbSuccess = true;
          console.log('🗑️ Successfully deleted voice from database');
        }
      } catch (error) {
        dbError = `Database deletion failed: ${error.message}`;
        console.error('🗑️', dbError);
      }

      const processingTime = Date.now() - startTime;
      console.log(`🗑️ Delete operation completed in ${processingTime}ms`);

      // Determine overall success
      if (elevenLabsSuccess && dbSuccess) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Voice deleted successfully from both ElevenLabs and database',
          processingTime
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else if (elevenLabsSuccess && !dbSuccess) {
        return new Response(JSON.stringify({
          success: false,
          error: `Voice deleted from ElevenLabs but database cleanup failed: ${dbError}`,
          processingTime
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else if (!elevenLabsSuccess && dbSuccess) {
        return new Response(JSON.stringify({
          success: false,
          error: `Voice deleted from database but ElevenLabs deletion failed: ${elevenLabsError}`,
          processingTime
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: `Both deletions failed. ElevenLabs: ${elevenLabsError}, Database: ${dbError}`,
          processingTime
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle voice cloning (POST request)
    console.log(`🎙️ Processing voice cloning request`);
    
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

    console.log(`🎙️ Starting voice cloning process...`);

    // Create FormData for ElevenLabs voice creation API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', voiceName);
    elevenLabsFormData.append('description', voiceDescription);
    elevenLabsFormData.append('files', audioFile); // Note: ElevenLabs expects 'files' not 'files[]'
    elevenLabsFormData.append('remove_background_noise', 'false');

    const cloneUrl = 'https://api.elevenlabs.io/v1/voices/add';
    const cloneHeaders = {
      'xi-api-key': ELEVEN_LABS_API_KEY,
    };

    logElevenLabsRequest(cloneUrl, 'POST', cloneHeaders, elevenLabsFormData);
    
    const elevenLabsResponse = await fetch(cloneUrl, {
      method: 'POST',
      headers: cloneHeaders,
      body: elevenLabsFormData,
    });

    const { text: cloneResponseText, data: cloneResponseData } = await logElevenLabsResponse(elevenLabsResponse, 'CLONE');

    if (!elevenLabsResponse.ok) {
      console.error('🎙️ ElevenLabs API error during cloning');
      return new Response(JSON.stringify({
        success: false,
        error: `Voice cloning failed (${elevenLabsResponse.status}): ${cloneResponseText}`
      }), {
        status: elevenLabsResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!cloneResponseData || !cloneResponseData.voice_id) {
      console.error('🎙️ No voice_id in response:', cloneResponseData);
      return new Response(JSON.stringify({
        success: false,
        error: 'No voice ID received from ElevenLabs voice cloning service'
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`🎙️ Voice cloned successfully with ID: ${cloneResponseData.voice_id}`);

    // Save to database
    console.log(`🎙️ Saving voice clone to database...`);
    const { data: dbResult, error: dbError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_id: user.id,
        voice_id: cloneResponseData.voice_id,
        voice_name: voiceName,
        voice_description: voiceDescription,
        elevenlabs_data: {
          ...cloneResponseData,
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
        const cleanupResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${cloneResponseData.voice_id}`, {
          method: 'DELETE',
          headers: {
            'xi-api-key': ELEVEN_LABS_API_KEY,
          },
        });
        console.log('🎙️ Cleanup response status:', cleanupResponse.status);
      } catch (cleanupError) {
        console.error('🎙️ Failed to cleanup voice after DB error:', cleanupError);
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
    console.log(`🎙️ Voice clone saved successfully in ${processingTime}ms:`, dbResult);

    return new Response(JSON.stringify({
      success: true,
      voice_id: cloneResponseData.voice_id,
      voice_name: voiceName,
      message: 'Voice cloned successfully',
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
