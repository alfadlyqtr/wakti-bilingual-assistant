
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

console.log("🎙️ VOICE CLONE: Function loaded");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🎙️ Authenticated user: ${user.id} (${user.email})`);

    // Get user's profile to access email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const userEmail = profile?.email || user.email;
    
    if (!userEmail) {
      throw new Error('User email not found');
    }

    console.log(`🎙️ Using email for voice identification: ${userEmail}`);

    // Handle DELETE request (voice deletion)
    if (req.method === 'DELETE') {
      const requestBody = await req.json();
      const { voice_id, action } = requestBody;
      
      if (action !== 'delete' || !voice_id) {
        throw new Error('Invalid delete request - missing voice_id or action');
      }

      console.log(`🗑️ Deleting voice: ${voice_id}`);

      // First, verify the user owns this voice (using email)
      const { data: voiceData, error: voiceError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .eq('voice_id', voice_id)
        .eq('user_email', userEmail)
        .single();

      if (voiceError || !voiceData) {
        console.error('🗑️ Voice not found or not owned by user:', voiceError);
        throw new Error('Voice not found or access denied');
      }

      console.log(`🗑️ Confirmed voice ownership: ${voiceData.voice_name}`);

      try {
        // Delete from ElevenLabs first
        const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
          method: 'DELETE',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
        });

        console.log(`🗑️ ElevenLabs delete response status: ${deleteResponse.status}`);

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('🗑️ ElevenLabs delete error:', errorText);
          // Continue with database deletion even if ElevenLabs deletion fails
        } else {
          console.log('🗑️ Successfully deleted voice from ElevenLabs');
        }
      } catch (elevenLabsError) {
        console.error('🗑️ Error calling ElevenLabs delete API:', elevenLabsError);
        // Continue with database deletion
      }

      // Delete from database
      const { error: dbDeleteError } = await supabase
        .from('user_voice_clones')
        .delete()
        .eq('voice_id', voice_id)
        .eq('user_email', userEmail);

      if (dbDeleteError) {
        console.error('🗑️ Database delete error:', dbDeleteError);
        throw new Error('Failed to delete voice from database');
      }

      console.log('🗑️ Successfully deleted voice from database');

      return new Response(JSON.stringify({
        success: true,
        message: 'Voice deleted successfully'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle POST request (voice creation)
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;
    
    console.log(`🎙️ Voice cloning request:`, {
      hasAudioFile: !!audioFile,
      audioFileName: audioFile?.name,
      audioFileSize: audioFile?.size,
      audioFileType: audioFile?.type,
      voiceName: voiceName,
      userEmail: userEmail
    });

    if (!audioFile || !voiceName) {
      throw new Error('Missing required fields: audio file and voiceName are required');
    }

    console.log(`🎙️ Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Create FormData for ElevenLabs API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('files', audioFile, audioFile.name);
    elevenLabsFormData.append('name', voiceName);
    elevenLabsFormData.append('description', `Voice cloned via WAKTI - ${voiceName} (${userEmail})`);

    console.log(`🎙️ Calling ElevenLabs Voice Cloning API...`);

    // Use the correct ElevenLabs voice cloning endpoint
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
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

    // Save to database with email-based identification
    const { data: dbResult, error: dbError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_id: user.id,
        user_email: userEmail,
        voice_id: result.voice_id,
        voice_name: voiceName,
        voice_description: `Voice cloned via WAKTI - ${voiceName} (${userEmail})`,
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
      user_email: userEmail,
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
