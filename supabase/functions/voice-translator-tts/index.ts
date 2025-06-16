
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text) {
      console.error('🔊 Voice Translator TTS: No text provided');
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate text length (OpenAI has limits)
    if (text.length > 4096) {
      console.error('🔊 Voice Translator TTS: Text too long:', text.length);
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 4096 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided voice or default to 'alloy'
    const selectedVoice = voice || 'alloy';
    const finalVoice = selectedVoice === 'alloy' ? 'alloy' : 'alloy';

    console.log(`🔊 Voice Translator TTS: Generating speech for text length: ${text.length}, voice: ${finalVoice}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('🔊 Voice Translator TTS: OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reduced timeout from 30s to 10s for faster failures
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: finalVoice,
          input: text,
          response_format: 'mp3',
          speed: 1.0
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔊 Voice Translator TTS: OpenAI API error:', response.status, errorText);
        
        let errorMessage = 'Text-to-speech failed';
        if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again in a moment.';
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed. Please check API key.';
        } else if (response.status >= 500) {
          errorMessage = 'OpenAI service temporarily unavailable. Please try again.';
        }
        
        return new Response(
          JSON.stringify({ error: errorMessage, details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get audio data as arrayBuffer and convert to base64
      const audioBuffer = await response.arrayBuffer();
      
      if (audioBuffer.byteLength === 0) {
        console.error('🔊 Voice Translator TTS: Empty audio response');
        return new Response(
          JSON.stringify({ error: 'Empty audio response from OpenAI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Convert to base64 efficiently
      const uint8Array = new Uint8Array(audioBuffer);
      let binaryString = '';
      const chunkSize = 8192;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binaryString);
      
      console.log(`🔊 Voice Translator TTS: Audio generated successfully, size: ${audioBuffer.byteLength} bytes`);

      return new Response(
        JSON.stringify({ 
          audioContent: base64Audio,
          contentType: 'audio/mpeg',
          size: audioBuffer.byteLength
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json'
          } 
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('🔊 Voice Translator TTS: Request timeout (10s)');
        return new Response(
          JSON.stringify({ error: 'Audio generation timed out. Please try again.' }),
          { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('🔊 Voice Translator TTS: Fetch error:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('🔊 Voice Translator TTS: Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Text-to-speech service temporarily unavailable', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
