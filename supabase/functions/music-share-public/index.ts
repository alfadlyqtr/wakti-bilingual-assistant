import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let trackId = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      trackId = (url.searchParams.get("id") || "").trim();
    } else {
      const body = await req.json().catch(() => ({}));
      trackId = (body?.id || "").toString().trim();
    }

    if (!trackId) {
      return new Response(JSON.stringify({ error: "Missing track id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseService
      .from("user_music_tracks")
      .select("id, created_at, title, prompt, include_styles, requested_duration_seconds, duration, cover_url, signed_url, storage_path, mime, meta")
      .eq("id", trackId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to fetch track" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = data.meta?.status;
    if (status === "generating" || status === "failed" || data.storage_path?.includes("_pending.mp3")) {
      return new Response(JSON.stringify({ error: "This track is not ready to share" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let playUrl: string | null = data.signed_url;
    if (!playUrl && data.storage_path) {
      const base = SUPABASE_URL.replace(/\/$/, "");
      const path = data.storage_path.startsWith("/") ? data.storage_path.slice(1) : data.storage_path;
      playUrl = `${base}/storage/v1/object/public/music/${path}`;
    }

    if (!playUrl) {
      return new Response(JSON.stringify({ error: "No audio URL found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      track: {
        id: data.id,
        created_at: data.created_at,
        title: data.title,
        prompt: data.prompt,
        include_styles: data.include_styles,
        requested_duration_seconds: data.requested_duration_seconds,
        duration: data.duration,
        cover_url: data.cover_url,
        mime: data.mime,
        meta: data.meta,
      },
      playUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
