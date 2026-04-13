import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CloudConvertTask {
  name: string;
  status: string;
  message?: string;
  result?: {
    files?: Array<{ url: string }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization") || "";
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const audioUrl: string = body?.audio_url || "";
    const coverUrl: string = body?.cover_url || "";
    const trackId: string = body?.track_id || "";
    const visualizer: boolean = body?.visualizer === true;

    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "audio_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!coverUrl) {
      return new Response(JSON.stringify({ error: "cover_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[music-track-to-mp4] Calling render server for user ${user.id}, track ${trackId}`);

    // Delegate to the Render server which has real FFmpeg installed.
    // The server handles: download files → ffmpeg → upload to Supabase → return URL.
    const renderServerUrl = "https://wakti-vision-proxy.onrender.com";

    const renderRes = await fetch(`${renderServerUrl}/api/music/to-mp4`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: audioUrl,
        cover_url: coverUrl,
        track_id: trackId,
        user_id: user.id,
        visualizer,
      }),
      signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min max
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error("[music-track-to-mp4] Render server error:", errText);
      return new Response(
        JSON.stringify({ error: "Video render failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await renderRes.json();
    const videoUrl = result?.video_url as string | null;

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "No video URL returned from render server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[music-track-to-mp4] Done: ${videoUrl}`);

    return new Response(
      JSON.stringify({ success: true, video_url: videoUrl, storage_path: result?.storage_path }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[music-track-to-mp4] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
