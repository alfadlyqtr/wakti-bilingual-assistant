
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Transcribe audio request received");
    
    // Get audio data from request
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    
    if (!audioFile || !(audioFile instanceof File)) {
      console.error("Missing audio file in request");
      return new Response(
        JSON.stringify({ error: "Audio file is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Maximum allowed audio duration (2 minutes = ~40MB approximate for high quality audio)
    const MAX_AUDIO_SIZE = 40 * 1024 * 1024; 
    
    if (audioFile.size > MAX_AUDIO_SIZE) {
      console.error(`Audio file too large: ${audioFile.size} bytes`);
      return new Response(
        JSON.stringify({ error: "Audio file exceeds maximum allowed duration (2 minutes)" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`Processing audio file: ${audioFile.size} bytes, type: ${audioFile.type}`);

    // Create FormData for OpenAI API
    const openAIFormData = new FormData();
    openAIFormData.append("file", audioFile);
    openAIFormData.append("model", "whisper-1");
    openAIFormData.append("response_format", "json");
    
    // Try to auto-detect language
    // Note: Not specifying a language lets Whisper auto-detect, which works great 
    // for English, Arabic and mixed language content
    
    console.log("Calling OpenAI Whisper API...");

    // Call OpenAI Whisper API
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAIFormData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Whisper API error:", result);
      throw new Error(result.error?.message || "Transcription failed");
    }

    console.log("Transcription successful");
    
    // Return the transcription
    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in transcribe-audio function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
