
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { ElevenLabsClient } from "https://esm.sh/@elevenlabs/elevenlabs-js@2.4.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

console.log("🎙️ VOICE CLONE: Function initialized");
console.log("🎙️ ElevenLabs API Key available:", !!ELEVENLABS_API_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  console.log(`🎙️ Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify ElevenLabs API key
    if (!ELEVENLABS_API_KEY) {
      console.error('🎙️ ELEVENLABS_API_KEY not configured');
      throw new Error('ElevenLabs API key not configured');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('🎙️ Authentication failed:', authError);
      throw new Error('Authentication failed');
    }

    console.log(`🎙️ Authenticated user: ${user.id} (${user.email})`);

    // Get user's profile to access email
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const userEmail = profile?.email || user.email;
    
    if (!userEmail) {
      throw new Error('User email not found');
    }

    console.log(`🎙️ User email: ${userEmail}`);

    // Handle DELETE request (voice deletion)
    if (req.method === 'DELETE') {
      const requestBody = await req.json();
      const { voice_id, action } = requestBody;
      
      if (action !== 'delete' || !voice_id) {
        throw new Error('Invalid delete request - missing voice_id or action');
      }

      console.log(`🗑️ Deleting voice: ${voice_id}`);

      // Verify the user owns this voice (using service role to bypass RLS)
      const { data: voiceData, error: voiceError } = await supabaseService
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

      // Initialize ElevenLabs client
      const elevenlabs = new ElevenLabsClient({
        apiKey: ELEVENLABS_API_KEY,
      });

      try {
        // Delete from ElevenLabs using official client
        await elevenlabs.voices.delete(voice_id);
        console.log(`🗑️ Successfully deleted voice from ElevenLabs: ${voice_id}`);
      } catch (elevenLabsError) {
        console.error('🗑️ Error calling ElevenLabs delete API:', elevenLabsError);
        // Continue with database deletion even if ElevenLabs deletion fails
      }

      // Delete from database using service role
      const { error: dbDeleteError } = await supabaseService
        .from('user_voice_clones')
        .delete()
        .eq('voice_id', voice_id)
        .eq('user_email', userEmail);

      if (dbDeleteError) {
        console.error('🗑️ Database delete error:', dbDeleteError);
        throw new Error('Failed to delete voice from database');
      }

      console.log('🗑️ Successfully deleted voice');

      return new Response(JSON.stringify({
        success: true,
        message: 'Voice deleted successfully'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Handle POST request (voice creation using official ElevenLabs client)
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

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

    // Validate file size (max 10MB)
    if (audioFile.size > 10 * 1024 * 1024) {
      throw new Error('Audio file too large. Maximum size is 10MB');
    }

    // Validate file type
    if (!audioFile.type.startsWith('audio/')) {
      throw new Error('Invalid file type. Only audio files are allowed');
    }

    // Convert File to ArrayBuffer for ElevenLabs client
    const audioBuffer = await audioFile.arrayBuffer();
    const audioUint8Array = new Uint8Array(audioBuffer);

    console.log(`🎙️ Calling ElevenLabs Voice Clone API using official client...`);

    // Initialize ElevenLabs client
    const elevenlabs = new ElevenLabsClient({
      apiKey: ELEVENLABS_API_KEY,
    });

    // Use ElevenLabs official Voice Clone API (IVC - Instant Voice Cloning)
    const result = await elevenlabs.voices.ivc.create({
      name: voiceName,
      description: `Voice cloned via WAKTI - ${voiceName} (${userEmail})`,
      files: [audioUint8Array],
    });

    console.log('🎙️ Voice cloning result:', {
      voiceId: result.voice_id,
      voiceName: result.name
    });

    if (!result.voice_id) {
      console.error('🎙️ No voice_id in response:', result);
      throw new Error('No voice_id received from ElevenLabs API');
    }

    // Save to database using service role to bypass RLS
    const { data: dbResult, error: dbError } = await supabaseService
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
      // Try to cleanup ElevenLabs voice if database insert fails
      try {
        await elevenlabs.voices.delete(result.voice_id);
        console.log('🎙️ Cleaned up ElevenLabs voice after database error');
      } catch (cleanupError) {
        console.error('🎙️ Failed to cleanup ElevenLabs voice:', cleanupError);
      }
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
