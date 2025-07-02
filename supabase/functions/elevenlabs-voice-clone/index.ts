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

    console.log(`🎙️ Authenticated user: ${user.id}`);

    if (req.method === 'POST') {
      // Create voice clone
      const formData = await req.formData();
      const voiceName = formData.get('voice_name') as string;
      const voiceDescription = formData.get('voice_description') as string;
      const audioFile = formData.get('audio_file') as File;

      if (!voiceName || !audioFile) {
        throw new Error('Voice name and audio file are required');
      }

      console.log(`🎙️ Creating voice clone: ${voiceName}`);

      // Prepare form data for ElevenLabs
      const elevenlabsFormData = new FormData();
      elevenlabsFormData.append('name', voiceName);
      if (voiceDescription) {
        elevenlabsFormData.append('description', voiceDescription);
      }
      elevenlabsFormData.append('files', audioFile);

      // Call ElevenLabs API
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: elevenlabsFormData,
      });

      console.log(`🎙️ ElevenLabs API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎙️ ElevenLabs API error:', errorText);
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

      return new Response(JSON.stringify({
        success: true,
        voice: data
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'GET') {
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

      return new Response(JSON.stringify({
        success: true,
        voices: voices || []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } else if (req.method === 'DELETE') {
      // Delete voice
      const { voice_id } = await req.json();

      if (!voice_id) {
        throw new Error('Voice ID is required');
      }

      console.log(`🎙️ Deleting voice: ${voice_id}`);

      // Delete from ElevenLabs
      const deleteResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voice_id}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('🎙️ ElevenLabs delete error:', errorText);
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