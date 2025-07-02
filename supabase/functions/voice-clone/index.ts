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
      
      if (action !== 'delete' || !voice_id) {
        throw new Error('Invalid delete request - missing voice_id or action');
      }

      console.log(`🗑️ Deleting voice: ${voice_id}`);

      // First, verify the user owns this voice
      const { data: voiceData, error: voiceError } = await supabase
        .from('user_voice_clones')
        .select('*')
        .eq('voice_id', voice_id)
        .eq('user_id', user.id)
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
            'xi-api-key': ELEVEN_LABS_API_KEY,
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
        .eq('user_id', user.id);

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

    // Handle other requests (existing voice cloning logic)
    const requestBody = await req.json();
    const { audio_url, voice_name, voice_description } = requestBody;
    
    console.log(`🎙️ Voice cloning request:`, {
      hasAudioUrl: !!audio_url,
      voiceName: voice_name,
      voiceDescription: voice_description
    });

    if (!audio_url || !voice_name) {
      throw new Error('Missing required fields: audio_url and voice_name are required');
    }

    // Rest of the existing voice cloning logic...
    // (keeping existing code for voice creation)

    console.log(`🎙️ Calling ElevenLabs Voice Cloning API...`);

    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
      body: JSON.stringify({
        name: voice_name,
        description: voice_description || 'Voice cloned via WAKTI',
        files: [audio_url]
      }),
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
        voice_name: voice_name,
        voice_description: voice_description,
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
      voice_name: voice_name,
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
