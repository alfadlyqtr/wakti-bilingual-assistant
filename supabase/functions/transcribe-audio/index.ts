
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.32.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// List of audio formats supported by OpenAI Whisper API
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'wav', 'webm'];

// Function to validate UUID format using regex
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

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
    let filePath;
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
        filePath = data.filePath; // Get separate file path for storage retrieval
        
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
        
        // Validate UUID format
        if (!isValidUUID(recordingId)) {
          console.error(`Invalid UUID format for recordingId: ${recordingId}`);
          return new Response(
            JSON.stringify({ error: `Invalid UUID format for recordingId: ${recordingId}` }),
            { 
              status: 400, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        
        console.log(`Fetching recording with ID: ${recordingId}`);
        
        // Check if the voice_summary record exists
        const { data: summaryData, error: summaryError } = await supabase
          .from("voice_summaries")
          .select("id, title, transcript, user_id, file_format")
          .eq("id", recordingId)
          .single();
          
        if (summaryError) {
          console.error("Error checking summary record:", summaryError);
          
          // Update the record to indicate transcript processing failed
          await supabase
            .from("voice_summaries")
            .update({ 
              is_processing_transcript: false,
              transcript_error: `Summary record error: ${summaryError.message}`,
              transcript_completed_at: new Date().toISOString()
            })
            .eq("id", recordingId);
            
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
        
        // Extract file format from the database if available, otherwise default to webm (for backward compatibility)
        fileFormat = summaryData.file_format || "webm";
        console.log(`Using file format from database: ${fileFormat}`);
        
        // Try to construct all possible file paths that might exist
        const possiblePaths = [];
        
        // Primary file path constructed based on file_format from the database
        const primaryPath = `${summaryData.user_id || 'anonymous'}/${recordingId}/recording.${fileFormat}`;
        possiblePaths.push(primaryPath);
        
        // Add fallback paths for backward compatibility
        possiblePaths.push(`${summaryData.user_id || 'anonymous'}/${recordingId}/recording.webm`); // webm fallback
        possiblePaths.push(`${summaryData.user_id || 'anonymous'}/${recordingId}/recording.mp3`);  // mp3 fallback
        
        // If a custom path was provided in the request, try that first
        if (filePath) {
          possiblePaths.unshift(filePath);
        }
        
        console.log("Attempting to find recording in the following paths:", possiblePaths);
        
        // Try each path in order until we find the file
        let fileData = null;
        let actualPath = null;
        
        for (const path of possiblePaths) {
          console.log(`Checking for file at: ${path}`);
          
          const { data: downloadData, error: downloadError } = await supabase.storage
            .from("voice_recordings")
            .download(path);
            
          if (!downloadError && downloadData) {
            console.log(`Found audio file at: ${path}`);
            fileData = downloadData;
            actualPath = path;
            // Extract the format from the actual path found
            fileFormat = path.split('.').pop()?.toLowerCase() || fileFormat;
            break;
          }
        }
        
        if (!fileData || !actualPath) {
          const errorMessage = "Audio file not found in any of the expected locations";
          console.error(errorMessage);
          
          // Update the voice_summaries record to indicate there was an error
          await supabase
            .from("voice_summaries")
            .update({ 
              transcript_error: errorMessage,
              is_processing_transcript: false,
              transcript_completed_at: new Date().toISOString()
            })
            .eq("id", recordingId);
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { 
              status: 404, 
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }
        
        // Set content type based on the file format
        let contentType = 'audio/webm';
        if (fileFormat === 'mp3' || fileFormat === 'mpeg') {
          contentType = 'audio/mpeg';
        } else if (fileFormat === 'wav') {
          contentType = 'audio/wav';
        } else if (fileFormat === 'ogg') {
          contentType = 'audio/ogg';
        }
        
        audioFile = new File([fileData], `audio.${fileFormat}`, { type: contentType });
        console.log(`Successfully retrieved audio file: ${audioFile.size} bytes, format: ${fileFormat}, type: ${contentType}`);
      } catch (jsonError) {
        console.error("Error processing JSON data:", jsonError);
        
        // Update the record to indicate transcript processing failed
        if (recordingId) {
          await supabase
            .from("voice_summaries")
            .update({ 
              is_processing_transcript: false,
              transcript_error: `Failed to process request data: ${jsonError.message}`,
              transcript_completed_at: new Date().toISOString()
            })
            .eq("id", recordingId);
        }
        
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
      
      // Update the record to indicate transcript processing failed
      if (recordingId) {
        await supabase
          .from("voice_summaries")
          .update({ 
            is_processing_transcript: false,
            transcript_error: "No audio file was provided or retrieved",
            transcript_completed_at: new Date().toISOString()
          })
          .eq("id", recordingId);
      }
      
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
      
      if (recordingId) {
        await supabase
          .from("voice_summaries")
          .update({ 
            transcript_error: "Audio file exceeds maximum allowed duration (2 minutes)",
            is_processing_transcript: false,
            transcript_completed_at: new Date().toISOString()
          })
          .eq("id", recordingId);
      }
      
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
      
      // Update the voice_summaries record to indicate there was an error if recordingId exists
      if (recordingId) {
        await supabase
          .from("voice_summaries")
          .update({ 
            transcript_error: `Error: ${result.error?.message || "Transcription failed"}`,
            is_processing_transcript: false,
            transcript_completed_at: new Date().toISOString()
          })
          .eq("id", recordingId);
      }
      
      throw new Error(result.error?.message || "Transcription failed");
    }

    console.log("Transcription successful");
    
    // If we have a recordingId, update the voice_summaries table with the transcript
    if (recordingId && result.text) {
      console.log(`Updating voice_summary record ${recordingId} with transcript`);
      
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
          call: /\b(call with|speaking with|talked to|conversation with)\b/i,
          project: /\b(project|initiative|program|development)\b/i,
          report: /\b(report|status|update|progress|numbers|metrics)\b/i
        };
        
        // Check for pattern matches to categorize the recording
        let recordingType = "";
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(text)) {
            recordingType = type;
            break;
          }
        }
        
        // Improved title extraction - try to get a coherent phrase
        const firstSentence = result.text.split(/[.!?]/, 1)[0].trim();
        const firstSegment = firstSentence.split(',', 1)[0].trim();
        
        // If the segment is a reasonable length, use it directly
        if (firstSegment.length >= 10 && firstSegment.length <= 60) {
          smartTitle = firstSegment;
        } 
        // Otherwise for longer text, extract key parts
        else if (firstSegment.length > 60) {
          // Look for subject + verb + object pattern
          const words = firstSegment.split(' ');
          const wordCount = Math.min(Math.max(4, Math.floor(words.length / 3)), 8);
          smartTitle = words.slice(0, wordCount).join(' ') + "...";
        }
        // For very short segments, use the longer form if available
        else {
          smartTitle = firstSentence.length <= 60 ? firstSentence : firstSegment + "...";
        }
        
        // If we detected a type, prefix it (unless it's already in the title)
        if (recordingType && !smartTitle.toLowerCase().includes(recordingType)) {
          smartTitle = recordingType.charAt(0).toUpperCase() + recordingType.slice(1) + ": " + smartTitle;
        }
        
        // Ensure first letter is capitalized
        smartTitle = smartTitle.charAt(0).toUpperCase() + smartTitle.slice(1);
      }
      
      try {
        const { error: updateError } = await supabase
          .from("voice_summaries")
          .update({ 
            transcript: result.text,
            title: smartTitle,
            is_processing_transcript: false,
            transcript_completed_at: new Date().toISOString()
          })
          .eq("id", recordingId);
          
        if (updateError) {
          console.error("Error updating voice summary with transcript:", updateError);
          // Continue anyway - we'll return the transcript to the client even if DB update fails
        } else {
          console.log("Voice summary successfully updated with transcript and smart title");
          
          // Automatically trigger summary generation after successful transcription
          try {
            // We don't await this - let it run in the background
            fetch(`${SUPABASE_URL}/functions/v1/generate-summary`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Use service role key for admin access
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ recordingId }),
            });
            console.log(`Initiated background summary generation for recording ${recordingId}`);
          } catch (summaryError) {
            console.error("Error initiating summary generation:", summaryError);
            // Don't fail the request if summary generation fails
          }
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
