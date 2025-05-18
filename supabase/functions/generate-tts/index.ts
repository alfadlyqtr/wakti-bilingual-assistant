
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import OpenAI from "https://esm.sh/openai@4.20.1";

// Get environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

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

    const { recordingId, voiceGender, language } = await req.json();

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

    // Field name change: use summary instead of summary_text
    if (!recording.summary) {
      return new Response(
        JSON.stringify({ error: "Summary not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Determine which OpenAI TTS voice to use based on language and gender
    let voice = "alloy"; // Default voice

    if (language === "ar") {
      voice = voiceGender === "female" ? "shimmer" : "echo"; // Arabic voices
    } else {
      voice = voiceGender === "female" ? "nova" : "onyx"; // English voices
    }

    // Generate TTS using OpenAI API
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "tts-1",
        input: recording.summary,
        voice: voice,
        response_format: "mp3"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(
        JSON.stringify({ error: "TTS generation failed", details: errorData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioData = await response.arrayBuffer();
    
    // Upload the TTS audio to Supabase Storage using standardized path
    const fileName = `voice_recordings/${recording.user_id}/${recordingId}/summary.mp3`;
    const { error: uploadError } = await supabase
      .storage
      .from("voice_recordings")
      .upload(fileName, audioData, {
        contentType: "audio/mpeg",
        upsert: true
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: "Failed to upload TTS audio", details: uploadError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the public URL for the audio file
    const { data: publicUrl } = supabase
      .storage
      .from("voice_recordings")
      .getPublicUrl(fileName);

    // Update the recording with the TTS audio URL and preferences
    const { error: updateError } = await supabase
      .from("voice_summaries")
      .update({
        summary_audio_url: publicUrl.publicUrl,
        summary_language: language || "en",
        voice_gender: voiceGender || "male",
        updated_at: new Date().toISOString()
      })
      .eq("id", recordingId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update recording", details: updateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, audioUrl: publicUrl.publicUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
