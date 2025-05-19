
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Get environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // For detailed logging
    console.log("Starting generate-summary function");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );

    if (authError || !authData.user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { recordingId } = await req.json();
    console.log(`Processing summary for recording: ${recordingId}`);

    if (!recordingId) {
      console.error("No recording ID provided");
      return new Response(
        JSON.stringify({ error: "Recording ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, update the status to indicate we're processing the summary
    const { error: statusUpdateError } = await supabase
      .from("voice_summaries")
      .update({
        is_processing_summary: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);
      
    if (statusUpdateError) {
      console.error("Failed to update processing status:", statusUpdateError);
      // Continue anyway
    }

    // Get the recording details
    const { data: recording, error: recordingError } = await supabase
      .from("voice_summaries")
      .select("*")
      .eq("id", recordingId)
      .single();

    if (recordingError || !recording) {
      console.error("Recording not found:", recordingError);
      return new Response(
        JSON.stringify({ error: "Recording not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use transcript field
    if (!recording.transcript) {
      console.error("Transcription not available for:", recordingId);
      return new Response(
        JSON.stringify({ error: "Transcription not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling DeepSeek API for summary generation");
    
    // Generate summary using DeepSeek API
    const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are an intelligent assistant that creates clear, concise summaries of voice recordings. Focus on extracting key information, action items, and important details."
          },
          {
            role: "user",
            content: `Please summarize the following transcription in bullet points. Extract key points, decisions, action items, and dates if present:\n\n${recording.transcript}`
          }
        ],
        max_tokens: 1000
      })
    });

    if (!deepseekResponse.ok) {
      const deepseekError = await deepseekResponse.json();
      console.error("DeepSeek API error:", deepseekError);
      
      // Update the recording to indicate failure
      await supabase
        .from("voice_summaries")
        .update({
          is_processing_summary: false,
          summary_error: JSON.stringify(deepseekError),
          updated_at: new Date().toISOString()
        })
        .eq("id", recordingId);
      
      return new Response(
        JSON.stringify({ error: "Summary generation failed", details: deepseekError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received summary from DeepSeek API");
    const summaryResponse = await deepseekResponse.json();
    const summary = summaryResponse.choices[0].message.content;

    console.log("Updating voice_summaries record with summary");
    
    // Update the recording with the summary and mark summary as completed
    const { error: updateError } = await supabase
      .from("voice_summaries")
      .update({
        summary: summary,
        is_processing_summary: false,
        summary_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", recordingId);

    if (updateError) {
      console.error("Failed to update recording with summary:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update recording", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Summary generated and saved successfully");
    
    // Automatically generate TTS for the summary
    try {
      console.log("Initiating TTS generation in the background");
      
      // Use Deno's EdgeRuntime.waitUntil to run this in the background without blocking
      // the response
      const generateTTS = async () => {
        try {
          console.log("Starting background TTS generation");
          
          // First, update status to indicate TTS generation is in progress
          await supabase
            .from("voice_summaries")
            .update({
              is_processing_tts: true,
              updated_at: new Date().toISOString()
            })
            .eq("id", recordingId);
          
          const ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              recordingId,
              voiceGender: "male", // Default
              language: "en" // Default
            })
          });
          
          if (!ttsResponse.ok) {
            console.error("TTS generation failed:", await ttsResponse.text());
            
            // Update status to indicate TTS generation failed
            await supabase
              .from("voice_summaries")
              .update({
                is_processing_tts: false,
                tts_error: "Failed to generate TTS",
                updated_at: new Date().toISOString()
              })
              .eq("id", recordingId);
            
          } else {
            console.log("TTS generation completed successfully");
            
            // TTS function will update the record with the TTS URL
            // Just mark processing as done here for safety
            await supabase
              .from("voice_summaries")
              .update({
                is_processing_tts: false,
                updated_at: new Date().toISOString()
              })
              .eq("id", recordingId);
          }
        } catch (ttsError) {
          console.error("Error in TTS generation:", ttsError);
          
          // Update status to indicate TTS generation failed
          await supabase
            .from("voice_summaries")
            .update({
              is_processing_tts: false,
              tts_error: String(ttsError),
              updated_at: new Date().toISOString()
            })
            .eq("id", recordingId);
        }
      };
      
      // Run TTS generation in the background
      EdgeRuntime.waitUntil(generateTTS());
      console.log("Initiated background TTS generation");
      
    } catch (ttsError) {
      console.error("Error initiating TTS generation:", ttsError);
      // Continue with response - don't fail if TTS generation fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        message: "Summary generated and TTS process started" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in generate-summary function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
