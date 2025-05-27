
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let audioBlob: Blob;
    let language = 'en';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (raw WebM blob upload)
      const formData = await req.formData();
      const audioFile = formData.get('audioBlob') as File;
      language = (formData.get('language') as string) || 'en';
      
      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: "Audio blob is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      audioBlob = audioFile;
    } else {
      // Handle JSON (for backwards compatibility)
      const body = await req.json();
      const { audioData, audioBlob: audioFile, language: lang = 'en' } = body;
      language = lang;

      if (audioFile instanceof Blob) {
        audioBlob = audioFile;
      } else if (audioData) {
        // Legacy base64 support
        const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
        audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      } else {
        return new Response(
          JSON.stringify({ error: "Audio data is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Processing audio blob, size:', audioBlob.size, 'language:', language);

    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language === 'ar' ? 'ar' : 'en');
    formData.append('response_format', 'json');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Whisper error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const result = await response.json();
    console.log('Transcription successful, text length:', result.text?.length || 0);

    return new Response(
      JSON.stringify({ 
        text: result.text,
        language: language,
        confidence: result.confidence || 0.9
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Voice transcription V2 error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
