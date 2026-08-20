import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safeSubmode(value: unknown): string {
  const asString = String(value || "shared").trim();
  return asString.slice(0, 80) || "shared";
}

function getStoragePathFromUrl(imageUrl: string): string | null {
  const marker = "/generated-images/";
  if (!imageUrl.includes(marker)) return null;
  const suffix = imageUrl.split(marker)[1] || "";
  const clean = decodeURIComponent(suffix).trim();
  return clean || null;
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

    const recipientId = authData.user.id;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const shareId = String(body?.shareId || "").trim();

    if (!shareId) {
      return new Response(JSON.stringify({ success: false, error: "Missing shareId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: share, error: shareError } = await (supabaseAdmin as any)
      .from("image_shares")
      .select("id, sender_id, recipient_id, source_image_id, status, accepted_image_id, sender_snapshot")
      .eq("id", shareId)
      .maybeSingle();

    if (shareError) throw shareError;
    if (!share) {
      return new Response(JSON.stringify({ success: false, error: "Share request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (share.recipient_id !== recipientId) {
      return new Response(JSON.stringify({ success: false, error: "Not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (share.status === "accepted" && share.accepted_image_id) {
      return new Response(JSON.stringify({ success: true, acceptedImageId: share.accepted_image_id, alreadyAccepted: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (share.status !== "pending") {
      return new Response(JSON.stringify({ success: false, error: "Share request is no longer pending" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: senderToRecipient }, { data: recipientToSender }] = await Promise.all([
      supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("user_id", share.sender_id)
        .eq("contact_id", recipientId)
        .eq("status", "approved")
        .maybeSingle(),
      supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("user_id", recipientId)
        .eq("contact_id", share.sender_id)
        .eq("status", "approved")
        .maybeSingle(),
    ]);

    if (!senderToRecipient || !recipientToSender) {
      return new Response(JSON.stringify({ success: false, error: "You must both be in each other's contacts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRecipientImage } = await (supabaseAdmin as any)
      .from("user_generated_images")
      .select("id")
      .eq("user_id", recipientId)
      .eq("meta->>shared_share_id", shareId)
      .maybeSingle();

    if (existingRecipientImage?.id) {
      await (supabaseAdmin as any)
        .from("image_shares")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
          accepted_image_id: existingRecipientImage.id,
        })
        .eq("id", shareId);

      return new Response(JSON.stringify({ success: true, acceptedImageId: existingRecipientImage.id, alreadyAccepted: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sourceImage, error: sourceError } = await (supabaseAdmin as any)
      .from("user_generated_images")
      .select("id, image_url, prompt, submode, quality, meta")
      .eq("id", share.source_image_id)
      .eq("user_id", share.sender_id)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!sourceImage?.image_url) {
      return new Response(JSON.stringify({ success: false, error: "Source image not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceStoragePath =
      (sourceImage.meta?.storage_path && String(sourceImage.meta.storage_path).trim()) ||
      getStoragePathFromUrl(String(sourceImage.image_url));

    const sharedMeta = {
      ...(sourceImage.meta || {}),
      shared_received: true,
      shared_share_id: shareId,
      shared_from_user_id: share.sender_id,
      shared_at: new Date().toISOString(),
      sender_name: share.sender_snapshot?.display_name || null,
      sender_username: share.sender_snapshot?.username || null,
      sender_avatar_url: share.sender_snapshot?.avatar_url || null,
      storage_path: sourceStoragePath || null,
      source_image_id: share.source_image_id,
      shared_file_model: true,
    };

    const { data: insertedImage, error: insertError } = await (supabaseAdmin as any)
      .from("user_generated_images")
      .insert({
        user_id: recipientId,
        image_url: sourceImage.image_url,
        prompt: sourceImage.prompt,
        submode: safeSubmode(sourceImage.submode),
        quality: sourceImage.quality,
        meta: sharedMeta,
        visibility: "private",
        is_profile_visible: false,
        is_public: false,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const { error: updateShareError } = await (supabaseAdmin as any)
      .from("image_shares")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
        accepted_image_id: insertedImage.id,
      })
      .eq("id", shareId);

    if (updateShareError) throw updateShareError;

    return new Response(JSON.stringify({ success: true, acceptedImageId: insertedImage.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("accept-image-share error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
