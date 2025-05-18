
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.32.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// List of audio formats supported by OpenAI Whisper API
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'wav', 'webm'];

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
    let fileFormat = 'mp3'; // Default to mp3
    
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      // Handle direct file upload (form data approach)
      try {
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
        
        fileFormat = audioFile.name.split('.').pop()?.toLowerCase() || 'mp3';
        console.log(`Received direct audio upload: ${audioFile.size} bytes, type: ${audioFile.type}, format: ${fileFormat}`);
        
        // Validate file format
        if (!validateFileFormat(fileFormat)) {
          console.error(`Invalid file format: ${fileFormat}`);
          return new Response(
            JSON.stringify({ 
              error: `Invalid file format: ${fileFormat}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}` 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
      } catch (formError) {
        console.error("Error processing form data:", formError);
        return new Response(
          JSON.stringify({ error: `Failed to process form data: ${formError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    } 
    else {
      // Handle recordingId approach (JSON data)
      try {
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
        
        // Check if the voice_summary record exists
        if (summaryId) {
          const { data: summaryData, error: summaryError } = await supabase
            .from("voice_summaries")
            .select("id, title, transcript")
            .eq("id", summaryId)
            .single();
            
          if (summaryError) {
            console.error("Error checking summary record:", summaryError);
            return new Response(
              JSON.stringify({ error: `Summary record error: ${summaryError.message}` }),
              { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }
          
          if (!summaryData) {
            console.error("Summary record not found");
            return new Response(
              JSON.stringify({ error: "Summary record not found" }),
              { 
                status: 404, 
                headers: { ...corsHeaders, "Content-Type": "application/json" }
              }
            );
          }
          
          // Skip processing if transcript already exists
          if (summaryData.transcript) {
            console.log("Summary already has a transcript, returning existing transcript");
            return new Response(
              JSON.stringify({ text: summaryData.transcript }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        // Extract file format from recordingId
        // But always default to MP3 as that's our standard format now
        fileFormat = 'mp3';
        
        // Download audio file from storage
        console.log(`Attempting to download file from storage: ${recordingId}`);
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("voice_recordings")
          .download(recordingId);
        
        if (downloadError) {
          console.error("Error downloading recording:", downloadError);
          
          // Update the voice_summaries record to indicate there was an error
          if (summaryId) {
            await supabase
              .from("voice_summaries")
              .update({ 
                transcript: "Error: Could not retrieve audio file",
                title: "Recording Error"
              })
              .eq("id", summaryId);
          }
          
          return new Response(
            JSON.stringify({ error: `Failed to download recording: ${downloadError.message}` }),
            { 
              status: 404, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        
        if (!fileData) {
          console.error("File data is null after successful download");
          return new Response(
            JSON.stringify({ error: "File not found or empty" }),
            { 
              status: 404, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        
        // Set content type to MP3 for standardization
        const contentType = 'audio/mpeg';
        
        audioFile = new File([fileData], `audio.mp3`, { type: contentType });
        console.log(`Successfully retrieved audio file: ${audioFile.size} bytes, format: ${fileFormat}, type: ${contentType}`);
      } catch (jsonError) {
        console.error("Error processing JSON data:", jsonError);
        return new Response(
          JSON.stringify({ error: `Failed to process request data: ${jsonError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }
    
    if (!audioFile) {
      console.error("No audio file was obtained from the request");
      return new Response(
        JSON.stringify({ error: "No audio file was provided or retrieved" }),
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
      
      // Update the voice_summaries record to indicate there was an error
      if (summaryId) {
        await supabase
          .from("voice_summaries")
          .update({ 
            transcript: `Error: ${result.error?.message || "Transcription failed"}`,
            title: "Transcription Error"
          })
          .eq("id", summaryId);
      }
      
      throw new Error(result.error?.message || "Transcription failed");
    }

    console.log("Transcription successful");
    
    // If we have a summaryId, update the voice_summaries table with the transcript
    if (summaryId && result.text) {
      console.log(`Updating voice_summary record ${summaryId} with transcript`);
      
      // Generate smart title from the transcript - improved algorithm
      let smartTitle = "Untitled Recording";
      
      // Extract a smart title based on the transcript content
      if (result.text && result.text.trim().length > 0) {
        // Try to identify key topics or subject matter
        const text = result.text.toLowerCase();
        
        // Common meeting or conversation patterns to identify context
        const patterns = {
          meeting: /\b(meeting|discussion|sync|standup|review|planning|retrospective)\b/i,
          interview: /\b(interview|candidate|hiring|recruitment)\b/i,
          presentation: /\b(presentation|slides|deck|demonstrate|showing|demo)\b/i,
          lecture: /\b(lecture|class|course|teaching|lesson)\b/i,
          call: /\b(call with|speaking with|talked to|conversation with)\b/i
        };
        
        // Check for pattern matches to categorize the recording
        let recordingType = "";
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(text)) {
            recordingType = type;
            break;
          }
        }
        
        // Take first sentence or segment
        const firstSentence = result.text.split(/[.!?]/, 1)[0].trim();
        
        if (firstSentence.length <= 60) {
          // Use first sentence directly if it's reasonable length
          smartTitle = firstSentence;
        } else {
          // Extract meaningful parts from longer sentences
          // Extract first 3-7 words based on sentence length
          const words = firstSentence.split(' ');
          const wordCount = Math.min(Math.max(3, Math.floor(words.length / 5)), 7);
          smartTitle = words.slice(0, wordCount).join(' ') + "...";
        }
        
        // If we detected a type, prefix it (unless it's already in the title)
        if (recordingType && !smartTitle.toLowerCase().includes(recordingType)) {
          smartTitle = recordingType.charAt(0).toUpperCase() + recordingType.slice(1) + ": " + smartTitle;
        }
      }
      
      try {
        const { error: updateError } = await supabase
          .from("voice_summaries")
          .update({ 
            transcript: result.text,
            title: smartTitle  // Apply our smart title
          })
          .eq("id", summaryId);
          
        if (updateError) {
          console.error("Error updating voice summary with transcript:", updateError);
          // Continue anyway - we'll return the transcript to the client even if DB update fails
        } else {
          console.log("Voice summary successfully updated with transcript and smart title");
        }
      } catch (dbError) {
        console.error("Database error updating voice summary:", dbError);
        // Continue - we'll still return the transcript to the client
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

// Helper function to validate file formats
function validateFileFormat(format: string | undefined): boolean {
  if (!format) return false;
  return SUPPORTED_FORMATS.includes(format.toLowerCase());
}
