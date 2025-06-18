
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ELEVENLABS_API_KEY = "sk_7b19e76d94655f74d81063f3dd7b39cf9460ea743d40a532";

// Enhanced voice style configurations with extreme differences for maximum audibility
const VOICE_STYLES = {
  neutral: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
    model: 'eleven_multilingual_v2'
  },
  report: {
    stability: 1.0,
    similarity_boost: 1.0,
    style: 0.0,
    use_speaker_boost: true,
    model: 'eleven_multilingual_v2'
  },
  storytelling: {
    stability: 0.1,
    similarity_boost: 0.2,
    style: 1.0,
    use_speaker_boost: false,
    model: 'eleven_multilingual_v2'
  },
  poetry: {
    stability: 0.0,
    similarity_boost: 0.1,
    style: 1.0,
    use_speaker_boost: false,
    model: 'eleven_multilingual_v2'
  },
  teacher: {
    stability: 0.9,
    similarity_boost: 0.9,
    style: 0.1,
    use_speaker_boost: true,
    model: 'eleven_multilingual_v2'
  },
  sports: {
    stability: 0.2,
    similarity_boost: 0.3,
    style: 0.9,
    use_speaker_boost: false,
    model: 'eleven_multilingual_v2'
  }
};

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

    const { text, voice_id, style = 'neutral' } = await req.json();

    if (!text || !voice_id) {
      throw new Error('Text and voice_id are required');
    }

    // Validate style exists
    if (!VOICE_STYLES[style as keyof typeof VOICE_STYLES]) {
      console.error('🎵 Invalid style requested:', style);
      throw new Error(`Invalid style: ${style}. Available styles: ${Object.keys(VOICE_STYLES).join(', ')}`);
    }

    console.log('🎵 === TTS Generation Start ===');
    console.log('🎵 User ID:', user.id);
    console.log('🎵 Voice ID:', voice_id);
    console.log('🎵 Text length:', text.length);
    console.log('🎵 Style requested:', style);

    // Check character usage
    const { data: usage, error: usageError } = await supabase
      .from('user_voice_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (usageError) {
      console.error('🎵 Usage check error:', usageError);
      throw new Error('Failed to check character usage');
    }

    const remainingChars = usage.characters_limit + usage.extra_characters - usage.characters_used;
    if (text.length > remainingChars) {
      throw new Error(`Not enough characters remaining. You have ${remainingChars} characters left.`);
    }

    // Get voice settings for the selected style with extreme differences
    const styleSettings = VOICE_STYLES[style as keyof typeof VOICE_STYLES];
    console.log('🎵 === Style Configuration ===');
    console.log('🎵 Style name:', style);
    console.log('🎵 Stability:', styleSettings.stability);
    console.log('🎵 Similarity boost:', styleSettings.similarity_boost);
    console.log('🎵 Style intensity:', styleSettings.style);
    console.log('🎵 Speaker boost:', styleSettings.use_speaker_boost);
    console.log('🎵 Model:', styleSettings.model);

    // Prepare request body for ElevenLabs
    const requestBody = {
      text: text,
      model_id: styleSettings.model,
      voice_settings: {
        stability: styleSettings.stability,
        similarity_boost: styleSettings.similarity_boost,
        style: styleSettings.style,
        use_speaker_boost: styleSettings.use_speaker_boost
      },
    };

    console.log('🎵 === ElevenLabs Request ===');
    console.log('🎵 Request body:', JSON.stringify(requestBody, null, 2));
    console.log('🎵 API endpoint:', `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`);

    // Call ElevenLabs TTS API with enhanced style-specific settings
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('🎵 === ElevenLabs Response ===');
    console.log('🎵 Response status:', response.status);
    console.log('🎵 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎵 ElevenLabs API error:', response.status, errorText);
      throw new Error(`Failed to generate speech: ${response.status} - ${errorText}`);
    }

    console.log('🎵 ElevenLabs API successful, processing audio...');

    // Update character usage
    const { error: updateError } = await supabase
      .from('user_voice_usage')
      .update({
        characters_used: usage.characters_used + text.length,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('🎵 Failed to update character usage:', updateError);
    } else {
      console.log('🎵 Character usage updated successfully');
    }

    // Return audio as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    console.log('🎵 === Generation Complete ===');
    console.log('🎵 Audio buffer size:', audioBuffer.byteLength);
    console.log('🎵 Style applied:', style);
    console.log('🎵 Settings used:', JSON.stringify(styleSettings, null, 2));
    
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('🎵 === Error in voice-tts function ===');
    console.error('🎵 Error details:', error);
    console.error('🎵 Error message:', error.message);
    console.error('🎵 Error stack:', error.stack);
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
