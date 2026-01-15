import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VIDEOS_BUCKET = "videos";

function safeFilenameHint(value?: string) {
  return (value || "video")
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 32);
}

function guessExtension(contentType: string) {
  const ct = contentType.toLowerCase();
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime") || ct.includes("mov")) return "mov";
  if (ct.includes("mp4")) return "mp4";
  return "mp4";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sourceUrl, filenameHint } = await req.json();
    if (!sourceUrl) {
      return new Response(JSON.stringify({ error: "Missing sourceUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WaktiBot/1.0)",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Failed to fetch video: ${response.status} ${errorText}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawContentType = response.headers.get("content-type") || "";
    const cleanedContentType = rawContentType.split(";")[0].trim();
    const contentType =
      cleanedContentType && cleanedContentType !== "application/octet-stream"
        ? cleanedContentType
        : "video/mp4";
    const ext = guessExtension(contentType);
    const safeHint = safeFilenameHint(filenameHint);
    const fileName = `${safeHint}-${Date.now()}.${ext}`;
    const storagePath = `${user.id}/ai-videos/${fileName}`;

    const arrayBuffer = await response.arrayBuffer();
    const videoBlob = new Blob([arrayBuffer], { type: contentType });

    const { error: uploadError } = await supabase.storage
      .from(VIDEOS_BUCKET)
      .upload(storagePath, videoBlob, {
        contentType,
        cacheControl: "3600",
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message || "Failed to upload" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        storagePath,
        contentType,
        sizeBytes: videoBlob.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[import-external-video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
