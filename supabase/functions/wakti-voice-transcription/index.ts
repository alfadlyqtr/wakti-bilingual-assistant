
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
    console.log("Voice transcription: Processing audio");
    
    const { audioData, language = 'en' } = await req.json();

    if (!audioData) {
      return new Response(
        JSON.stringify({ error: "Audio data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert base64 audio to blob
    const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

    // Prepare form data
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language === 'ar' ? 'ar' : 'en');

    // Send to OpenAI Whisper
    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${await response.text()}`);
    }

    const result = await response.json();

    // Log successful AI usage
    await logAI({
      functionName: "wakti-voice-transcription",
      provider: "openai",
      model: "whisper-1",
      outputText: result.text,
      durationMs: Date.now() - startTime,
      status: "success"
    });

    return new Response(
      JSON.stringify({ 
        text: result.text,
        language: language
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Voice transcription error:", error);
    
    // Log failed AI usage
    await logAI({
      functionName: "wakti-voice-transcription",
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
