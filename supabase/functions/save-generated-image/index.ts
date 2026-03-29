import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40) || "generated";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = authData.user;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const imageUrl = String(body?.imageUrl || "").trim();
    const submode = String(body?.submode || "generated").trim();
    const filenameHint = String(body?.filenameHint || submode || "generated").trim();

    if (!imageUrl) {
      return new Response(JSON.stringify({ success: false, error: "Missing imageUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetchResp = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WaktiBot/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
    });

    if (!fetchResp.ok) {
      throw new Error(`Failed to fetch source image: ${fetchResp.status}`);
    }

    const blob = await fetchResp.blob();
    const contentType = fetchResp.headers.get("content-type") || blob.type || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg";
    const fileName = `${user.id}/${sanitizePart(filenameHint)}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("generated-images")
      .upload(fileName, blob, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(uploadErr.message);
    }

    const { data: urlData } = supabase.storage.from("generated-images").getPublicUrl(fileName);
    const publicUrl = (urlData?.publicUrl || "").replace(/%20/g, " ").trim();

    if (!publicUrl) {
      throw new Error("Failed to build public URL");
    }

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      storagePath: fileName,
      contentType,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("save-generated-image error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
