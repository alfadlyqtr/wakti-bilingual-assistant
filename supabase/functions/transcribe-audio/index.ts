
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Download the audio file
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from("voice_recordings")
      .download(`${recording.user_id}/${recordingId}.mp3`);
    
    if (audioError || !audioData) {
      return new Response(
        JSON.stringify({ error: "Audio file not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transcribe using OpenAI's Whisper API
    const formData = new FormData();
    formData.append("file", audioData);
    formData.append("model", "whisper-1");
    formData.append("language", recording.language || "en");
    
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const whisperError = await whisperResponse.json();
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: whisperError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcription = await whisperResponse.json();

    // Update the recording with the transcription
    const { error: updateError } = await supabase
      .from("voice_summaries")
      .update({
        transcription_text: transcription.text,
        transcription_status: "completed",
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
      JSON.stringify({ success: true, transcription: transcription.text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
