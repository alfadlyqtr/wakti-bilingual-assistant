import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Whitelist of allowed domains to proxy (security: prevent abuse)
const ALLOWED_DOMAINS = [
  "im.runware.ai",
  "hxauxozopvpzpdygoqwf.supabase.co",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get URL from query param or POST body
    let imageUrl: string | null = null;
    
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      imageUrl = params.get("url");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      imageUrl = body?.url;
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: only allow whitelisted domains
    if (!isAllowedUrl(imageUrl)) {
      return new Response(
        JSON.stringify({ error: "URL domain not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the image server-side
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Wakti-Image-Proxy/1.0",
        "Accept": "image/*",
      },
    });

    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${imageResponse.status}` }),
        { status: imageResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the image bytes
    const imageBytes = await imageResponse.arrayBuffer();
    
    // Detect content type from response or fallback
    let contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    
    // Ensure it's an image type
    if (!contentType.startsWith("image/")) {
      contentType = "image/jpeg";
    }

    // Return the image with safe headers
    return new Response(imageBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable", // 7 days cache
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
      },
    });

  } catch (err: unknown) {
    const message = (err as Error)?.message || String(err);
    console.error("wakti-image-proxy error:", message);
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
