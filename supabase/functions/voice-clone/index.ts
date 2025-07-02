
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
      throw new Error('ElevenLabs API key not configured');
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

      // First, check if voice exists in database and user owns it
      const { data: voiceData, error: voiceError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .eq('voice_id', voice_id)
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if not found

      console.log(`🗑️ Database lookup result:`, { 
        found: !!voiceData, 
        error: voiceError, 
        voiceData: voiceData ? { id: voiceData.id, voice_name: voiceData.voice_name } : null 
      });

      // Handle different scenarios
      let voiceExistsInDatabase = !!voiceData && !voiceError;
      let voiceExistsInElevenLabs = false;
      let elevenLabsDeleteSuccess = false;

      // Try to delete from ElevenLabs first
      try {
        console.log(`🗑️ Attempting to delete from ElevenLabs: ${voice_id}`);
        
        const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
          method: 'DELETE',
          headers: {
            'xi-api-key': ELEVEN_LABS_API_KEY,
          },
        });

        console.log(`🗑️ ElevenLabs delete response status: ${deleteResponse.status}`);

        if (deleteResponse.ok) {
          console.log('🗑️ Successfully deleted voice from ElevenLabs');
          voiceExistsInElevenLabs = true;
          elevenLabsDeleteSuccess = true;
        } else if (deleteResponse.status === 404) {
          console.log('🗑️ Voice not found in ElevenLabs (already deleted or never existed)');
          voiceExistsInElevenLabs = false;
          elevenLabsDeleteSuccess = true; // Consider it success if it's already gone
        } else {
          const errorText = await deleteResponse.text();
          console.error('🗑️ ElevenLabs delete error:', errorText);
          voiceExistsInElevenLabs = true; // Assume it exists but failed to delete
          elevenLabsDeleteSuccess = false;
        }
      } catch (elevenLabsError) {
        console.error('🗑️ Error calling ElevenLabs delete API:', elevenLabsError);
        voiceExistsInElevenLabs = true; // Assume it exists but we couldn't reach the API
        elevenLabsDeleteSuccess = false;
      }

      console.log(`🗑️ Status check:`, {
        voiceExistsInDatabase,
        voiceExistsInElevenLabs,
        elevenLabsDeleteSuccess
      });

      // Handle database deletion based on scenarios
      let dbDeleteSuccess = false;
      let dbDeleteError = null;

      if (voiceExistsInDatabase) {
        console.log(`🗑️ Deleting from database: ${voiceData.voice_name}`);
        
        const { error: dbDeleteErr } = await supabase
          .from('user_voice_clones')
          .delete()
          .eq('voice_id', voice_id)
          .eq('user_id', user.id);

        if (dbDeleteErr) {
          console.error('🗑️ Database delete error:', dbDeleteErr);
          dbDeleteError = dbDeleteErr;
        } else {
          console.log('🗑️ Successfully deleted voice from database');
          dbDeleteSuccess = true;
        }
      } else {
        console.log('🗑️ Voice not found in database (already deleted or never existed)');
        dbDeleteSuccess = true; // Consider it success if it's already gone
      }

      // Determine overall success based on scenarios
      let overallSuccess = false;
      let resultMessage = '';

      if (!voiceExistsInDatabase && !voiceExistsInElevenLabs) {
        // Voice doesn't exist anywhere - consider success
        overallSuccess = true;
        resultMessage = 'Voice was already deleted or never existed';
      } else if (voiceExistsInDatabase && !voiceExistsInElevenLabs) {
        // Only in database - success if DB deletion worked
        overallSuccess = dbDeleteSuccess;
        resultMessage = dbDeleteSuccess ? 'Voice deleted from database successfully' : 'Failed to delete voice from database';
      } else if (!voiceExistsInDatabase && voiceExistsInElevenLabs) {
        // Only in ElevenLabs - success if ElevenLabs deletion worked
        overallSuccess = elevenLabsDeleteSuccess;
        resultMessage = elevenLabsDeleteSuccess ? 'Voice deleted from ElevenLabs successfully' : 'Failed to delete voice from ElevenLabs';
      } else {
        // Exists in both - success if both deletions worked
        overallSuccess = dbDeleteSuccess && elevenLabsDeleteSuccess;
        if (overallSuccess) {
          resultMessage = 'Voice deleted successfully from both ElevenLabs and database';
        } else if (!dbDeleteSuccess && !elevenLabsDeleteSuccess) {
          resultMessage = 'Failed to delete voice from both ElevenLabs and database';
        } else if (!dbDeleteSuccess) {
          resultMessage = 'Deleted from ElevenLabs but failed to delete from database';
        } else {
          resultMessage = 'Deleted from database but failed to delete from ElevenLabs';
        }
      }

      console.log(`🗑️ Final result:`, { overallSuccess, resultMessage });

      if (!overallSuccess && dbDeleteError) {
        throw new Error(`Database deletion failed: ${dbDeleteError.message}`);
      } else if (!overallSuccess) {
        throw new Error(resultMessage);
      }

      return new Response(JSON.stringify({
        success: true,
        message: resultMessage,
        details: {
          voiceExistsInDatabase,
          voiceExistsInElevenLabs,
          dbDeleteSuccess,
          elevenLabsDeleteSuccess
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle voice cloning (FormData from frontend)
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;
    const voiceDescription = formData.get('voiceDescription') as string || 'Voice cloned via WAKTI';
    
    console.log(`🎙️ Voice cloning request:`, {
      hasAudioFile: !!audioFile,
      audioSize: audioFile?.size,
      voiceName: voiceName,
      voiceDescription: voiceDescription
    });

    if (!audioFile || !voiceName) {
      throw new Error('Missing required fields: audio file and voice name are required');
    }

    console.log(`🎙️ Calling ElevenLabs Voice Cloning API...`);

    // Create FormData for ElevenLabs API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', voiceName);
    elevenLabsFormData.append('description', voiceDescription);
    elevenLabsFormData.append('files', audioFile);

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
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`);
    }

    const result = await elevenLabsResponse.json();
    console.log('🎙️ Voice cloning result received:', {
      voiceId: result.voice_id,
      voiceName: result.name
    });

    if (!result.voice_id) {
      console.error('🎙️ No voice_id in response:', result);
      throw new Error('No voice_id received from ElevenLabs API');
    }

    // Save to database
    const { data: dbResult, error: dbError } = await supabase
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

    if (dbError) {
      console.error('🎙️ Database insert error:', dbError);
      throw new Error('Failed to save voice clone to database');
    }

    console.log('🎙️ Voice clone saved successfully:', dbResult);

    return new Response(JSON.stringify({
      success: true,
      voice_id: result.voice_id,
      voice_name: voiceName,
      message: 'Voice cloned successfully'
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
