
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.split(" ")[1] || ""
    );

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recordingId } = await req.json();

    if (!recordingId) {
      return new Response(
        JSON.stringify({ error: "Recording ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the recording details
    const { data: recording, error: recordingError } = await supabase
      .from("voice_summaries")
      .select("*")
      .eq("id", recordingId)
      .single();

    if (recordingError || !recording) {
      return new Response(
        JSON.stringify({ error: "Recording not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use transcript field
    if (!recording.transcript) {
      return new Response(
        JSON.stringify({ error: "Transcription not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      return new Response(
        JSON.stringify({ error: "Summary generation failed", details: deepseekError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summaryResponse = await deepseekResponse.json();
    const summary = summaryResponse.choices[0].message.content;

    // Update the recording with the summary - FIXED: removed updated_at field reference
    const { error: updateError } = await supabase
      .from("voice_summaries")
      .update({
        summary: summary
      })
      .eq("id", recordingId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update recording", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Automatically generate TTS for the summary
    try {
      // Use Deno's EdgeRuntime.waitUntil to run this in the background without blocking
      // the response
      const generateTTS = async () => {
        try {
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
          } else {
            console.log("TTS generation completed successfully");
          }
        } catch (ttsError) {
          console.error("Error in TTS generation:", ttsError);
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
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
