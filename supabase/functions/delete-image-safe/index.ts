import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getStoragePathFromMetaOrUrl(meta: any, imageUrl: string): string | null {
  const fromMeta = typeof meta?.storage_path === "string" ? meta.storage_path.trim() : "";
  if (fromMeta) return fromMeta;

  const marker = "/generated-images/";
  if (!imageUrl.includes(marker)) return null;
  const suffix = imageUrl.split(marker)[1] || "";
  const decoded = decodeURIComponent(suffix).trim();
  return decoded || null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration is missing Supabase credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const imageId = String(body?.imageId || "").trim();

    if (!imageId) {
      return new Response(JSON.stringify({ success: false, error: "Missing imageId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: imageRow, error: imageError } = await (supabaseAdmin as any)
      .from("user_generated_images")
      .select("id, user_id, image_url, meta")
      .eq("id", imageId)
      .maybeSingle();

    if (imageError) throw imageError;
    if (!imageRow) {
      return new Response(JSON.stringify({ success: false, error: "Image not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imageRow.user_id !== userId) {
      return new Response(JSON.stringify({ success: false, error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceImageId = String(imageRow?.meta?.source_image_id || imageRow.id);
    const storagePath = getStoragePathFromMetaOrUrl(imageRow.meta, imageRow.image_url || "");

    const { error: deleteRowError } = await (supabaseAdmin as any)
      .from("user_generated_images")
      .delete()
      .eq("id", imageId)
      .eq("user_id", userId);

    if (deleteRowError) throw deleteRowError;

    const [sourceOwnerRefRes, sharedRefRes, urlRefRes] = await Promise.all([
      supabaseAdmin
        .from("user_generated_images")
        .select("id", { count: "exact", head: true })
        .eq("id", sourceImageId),
      (supabaseAdmin as any)
        .from("user_generated_images")
        .select("id", { count: "exact", head: true })
        .eq("meta->>source_image_id", sourceImageId),
      supabaseAdmin
        .from("user_generated_images")
        .select("id", { count: "exact", head: true })
        .eq("image_url", imageRow.image_url || ""),
    ]);

    const totalRefs =
      Number(sourceOwnerRefRes.count || 0) +
      Number(sharedRefRes.count || 0) +
      Number(urlRefRes.count || 0);

    let deletedFromStorage = false;

    if (totalRefs === 0 && storagePath) {
      const { error: removeError } = await supabaseAdmin.storage.from("generated-images").remove([storagePath]);
      if (!removeError) deletedFromStorage = true;
      if (removeError) {
        console.warn("delete-image-safe storage remove failed:", removeError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      deletedImageId: imageId,
      deletedFromStorage,
      referencesRemaining: totalRefs,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("delete-image-safe error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
