
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAI } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎤 WAKTI VOICE V2: Processing request...');
    
    if (!OPENAI_API_KEY) {
      console.error('🎤 WAKTI VOICE V2: OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let audioBlob: Blob;
    let language = 'en';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (new method)
      console.log('🎤 WAKTI VOICE V2: Processing FormData upload');
      
      const formData = await req.formData();
      const audioFile = formData.get('audioBlob') as File;
      language = (formData.get('language') as string) || 'en';
      
      console.log('🎤 WAKTI VOICE V2: Audio file size:', audioFile?.size, 'Language:', language);
      
      if (!audioFile) {
        console.error('🎤 WAKTI VOICE V2: No audio file found in FormData');
        return new Response(
          JSON.stringify({ error: "Audio file is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      audioBlob = audioFile;
    } else {
      // Handle JSON (legacy method for backwards compatibility)
      console.log('🎤 WAKTI VOICE V2: Processing JSON upload (legacy)');
      
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

    console.log('🎤 WAKTI VOICE V2: Processing audio blob, size:', audioBlob.size, 'language:', language);

    // Prepare form data for OpenAI Whisper - FIXED FOR TRANSCRIPTION ONLY
    const startTime = Date.now();
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioBlob, 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    
    // CRITICAL FIX: Only set language for Arabic to ensure proper transcription
    // For Arabic, explicitly set the language to prevent auto-translation
    if (language === 'ar') {
      whisperFormData.append('language', 'ar');
      console.log('🎤 WAKTI VOICE V2: Set language to Arabic for proper transcription');
    }
    // For English or auto-detection, don't set language parameter to let Whisper auto-detect
    // but ensure we're using transcriptions endpoint (not translations)
    
    whisperFormData.append('response_format', 'json');

    console.log('🎤 WAKTI VOICE V2: Sending to OpenAI Whisper transcriptions endpoint (NOT translations)...');

    // CRITICAL: Use /transcriptions endpoint (not /translations) to avoid auto-translation
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    console.log('🎤 WAKTI VOICE V2: OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🎤 WAKTI VOICE V2: OpenAI Whisper error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const result = await response.json();
    console.log('🎤 WAKTI VOICE V2: Transcription successful, text length:', result.text?.length || 0);
    console.log('🎤 WAKTI VOICE V2: Transcribed text:', result.text);
    console.log('🎤 WAKTI VOICE V2: Expected language was:', language, 'Result should be in same language');

    // Log successful AI usage
    await logAI({
      functionName: "wakti-voice-v2",
      provider: "openai",
      model: "whisper-1",
      outputText: result.text,
      durationMs: Date.now() - startTime,
      status: "success",
      metadata: { audioSize: audioBlob.size, language }
    });

    return new Response(
      JSON.stringify({ 
        text: result.text,
        language: language,
        confidence: result.confidence || 0.9
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("🎤 WAKTI VOICE V2: Error:", error);
    
    // Log failed AI usage
    await logAI({
      functionName: "wakti-voice-v2",
      provider: "openai",
      model: "whisper-1",
      status: "error",
      errorMessage: (error as Error).message
    });

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
