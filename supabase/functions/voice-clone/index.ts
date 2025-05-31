
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ELEVENLABS_API_KEY = "sk_7b19e76d94655f74d81063f3dd7b39cf9460ea743d40a532";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const voiceName = formData.get('voiceName') as string;

    if (!audioFile || !voiceName) {
      throw new Error('Audio file and voice name are required');
    }

    console.log('Creating voice clone for user:', user.id);
    console.log('Voice name:', voiceName);
    console.log('Audio file size:', audioFile.size);

    // Check if user already has 3 voices
    const { data: existingVoices, error: countError } = await supabase
      .from('user_voice_clones')
      .select('id')
      .eq('user_id', user.id);

    if (countError) {
      throw new Error('Failed to check existing voices');
    }

    if (existingVoices && existingVoices.length >= 3) {
      throw new Error('You have reached the maximum of 3 voice clones');
    }

    // Create FormData for ElevenLabs API
    const elevenlabsFormData = new FormData();
    elevenlabsFormData.append('name', voiceName);
    elevenlabsFormData.append('files', audioFile);
    elevenlabsFormData.append('description', `Voice clone for ${user.email}`);

    // Call ElevenLabs Instant Voice Clone API
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: elevenlabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`Failed to create voice clone: ${errorText}`);
    }

    const result = await response.json();
    console.log('ElevenLabs response:', result);

    // Save voice clone to database
    const { data: savedVoice, error: saveError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_id: user.id,
        voice_id: result.voice_id,
        voice_name: voiceName,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Database save error:', saveError);
      throw new Error('Failed to save voice clone');
    }

    // Initialize or get user voice usage
    const { data: existingUsage } = await supabase
      .from('user_voice_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!existingUsage) {
      await supabase
        .from('user_voice_usage')
        .insert({
          user_id: user.id,
          characters_used: 0,
          characters_limit: 5000,
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        voice_id: result.voice_id,
        voice_name: voiceName,
        message: 'Voice clone created successfully'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in voice-clone function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
