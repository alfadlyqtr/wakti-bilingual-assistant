import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SlideData {
  title: string;
  subtitle?: string;
  bullets: string[];
  slideBg?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDurationMs?: number;
}

interface RequestBody {
  slides: SlideData[];
  presentationId: string;
  theme?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { slides, presentationId } = body;

    if (!slides || slides.length === 0) {
      return new Response(JSON.stringify({ error: "No slides provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For now, we'll create a simple approach:
    // 1. Generate slide images as data URLs
    // 2. Concatenate audio files
    // 3. Use a video generation service or return assets for client-side assembly

    // Since FFmpeg in Deno Edge Functions is complex, let's use a different approach:
    // Return the audio URLs and timing info, let the client use a proper video library

    // Fetch all audio files and combine them
    const audioBuffers: Uint8Array[] = [];
    const slideTiming: { startMs: number; durationMs: number }[] = [];
    let currentTimeMs = 0;
    const TRANSITION_BUFFER_MS = 2000;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      if (slide.audioUrl) {
        try {
          const audioResponse = await fetch(slide.audioUrl);
          if (audioResponse.ok) {
            const audioData = new Uint8Array(await audioResponse.arrayBuffer());
            audioBuffers.push(audioData);
            
            const durationMs = slide.audioDurationMs || 5000;
            slideTiming.push({
              startMs: currentTimeMs,
              durationMs: durationMs + TRANSITION_BUFFER_MS,
            });
            currentTimeMs += durationMs + TRANSITION_BUFFER_MS;
          } else {
            // No audio for this slide, use default timing
            slideTiming.push({
              startMs: currentTimeMs,
              durationMs: 3000 + TRANSITION_BUFFER_MS,
            });
            currentTimeMs += 3000 + TRANSITION_BUFFER_MS;
          }
        } catch (e) {
          console.error(`Failed to fetch audio for slide ${i}:`, e);
          slideTiming.push({
            startMs: currentTimeMs,
            durationMs: 3000 + TRANSITION_BUFFER_MS,
          });
          currentTimeMs += 3000 + TRANSITION_BUFFER_MS;
        }
      } else {
        slideTiming.push({
          startMs: currentTimeMs,
          durationMs: 3000 + TRANSITION_BUFFER_MS,
        });
        currentTimeMs += 3000 + TRANSITION_BUFFER_MS;
      }
    }

    // Combine audio buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      combinedAudio.set(buf, offset);
      offset += buf.length;
    }

    // Store combined audio in storage
    const audioFileName = `${user.id}/${presentationId}/combined-audio.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("presentation-audio")
      .upload(audioFileName, combinedAudio, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload combined audio:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to store audio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL for the combined audio
    const { data: signedUrlData } = await supabase.storage
      .from("presentation-audio")
      .createSignedUrl(audioFileName, 3600); // 1 hour expiry

    // Return the data needed for client-side video assembly
    // The client will use this to create the video with proper timing
    return new Response(
      JSON.stringify({
        success: true,
        combinedAudioUrl: signedUrlData?.signedUrl,
        slideTiming,
        totalDurationMs: currentTimeMs,
        message: "Audio combined successfully. Use timing data for video assembly.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Video generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
