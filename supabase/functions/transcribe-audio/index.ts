
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.32.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Transcribe audio request received");
    
    // Create a Supabase client with the service role key
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check if OpenAI API key is set
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "OpenAI API key configuration is missing" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get request body - can be either FormData with audio file OR JSON with recordingId
    let audioFile;
    let recordingId;
    let summaryId;
    
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      // Handle direct file upload (legacy approach)
      const formData = await req.formData();
      audioFile = formData.get("audio");
      
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
    } 
    else {
      // Handle recordingId approach (new approach)
      const data = await req.json();
      recordingId = data.recordingId;
      summaryId = data.summaryId;
      
      if (!recordingId) {
        console.error("Missing recordingId in request");
        return new Response(
          JSON.stringify({ error: "recordingId is required" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      console.log(`Fetching recording with ID: ${recordingId}`);
      
      // Download audio file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("voice_recordings")
        .download(recordingId);
      
      if (downloadError || !fileData) {
        console.error("Error downloading recording:", downloadError);
        return new Response(
          JSON.stringify({ error: `Failed to download recording: ${downloadError?.message || "Unknown error"}` }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      audioFile = new File([fileData], "audio.webm", { type: "audio/webm" });
      console.log(`Successfully retrieved audio file: ${audioFile.size} bytes`);
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
    
    // If we have a summaryId, update the voice_summaries table with the transcript
    if (summaryId && result.text) {
      console.log(`Updating voice_summary record ${summaryId} with transcript`);
      const { error: updateError } = await supabase
        .from("voice_summaries")
        .update({ transcript: result.text })
        .eq("id", summaryId);
        
      if (updateError) {
        console.error("Error updating voice summary with transcript:", updateError);
        // Continue anyway - we'll return the transcript to the client even if DB update fails
      } else {
        console.log("Voice summary successfully updated with transcript");
      }
    }
    
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
