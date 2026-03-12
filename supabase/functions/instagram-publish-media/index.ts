import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * instagram-publish-media
 *
 * Publishes generated images, videos, or Reels to the user's Instagram account.
 * SEPARATE from bot creation.
 *
 * POST body:
 *   media_type:      "image" | "video" | "reel"
 *   media_url:       publicly reachable HTTPS URL
 *   caption:         optional caption string
 *   publish_target:  "feed" | "reel" (default: "feed")
 *
 * Returns:
 *   { success, job_id, instagram_media_id, status }
 *   For video/reel: status may be "processing" — poll instagram-publish-status
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IG_GRAPH_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ── Step 1: Create a media container on Instagram ──
async function createMediaContainer(params: {
  igUserId: string;
  accessToken: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  publishTarget: string;
}): Promise<string> {
  const { igUserId, accessToken, mediaType, mediaUrl, caption, publishTarget } = params;

  const body: Record<string, string> = {
    access_token: accessToken,
    caption,
  };

  if (mediaType === "image") {
    // Standard image post
    body.image_url = mediaUrl;
    body.media_type = "IMAGE";
  } else if (mediaType === "reel" || (mediaType === "video" && publishTarget === "reel")) {
    // Reel
    body.video_url = mediaUrl;
    body.media_type = "REELS";
  } else {
    // Regular video post
    body.video_url = mediaUrl;
    body.media_type = "VIDEO";
  }

  console.log(`[instagram-publish-media] Creating container: type=${body.media_type} url=${mediaUrl.slice(0, 80)}`);

  const res = await fetch(`https://graph.instagram.com/${IG_GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, unknown>;
  console.log("[instagram-publish-media] Container response:", JSON.stringify(data));

  if (data.error || !data.id) {
    const errMsg = (data.error as Record<string, unknown>)?.message as string || "Failed to create media container";
    throw new Error(errMsg);
  }

  return data.id as string;
}

// ── Step 2: Check container status (for video/Reel) ──
async function checkContainerStatus(creationId: string, accessToken: string): Promise<string> {
  const res = await fetch(
    `https://graph.instagram.com/${IG_GRAPH_VERSION}/${creationId}?fields=status_code,status&access_token=${accessToken}`
  );
  const data = await res.json() as Record<string, unknown>;
  console.log("[instagram-publish-media] Container status:", JSON.stringify(data));
  return (data.status_code as string) || "IN_PROGRESS";
}

// ── Step 3: Publish the container ──
async function publishContainer(igUserId: string, creationId: string, accessToken: string): Promise<string> {
  const res = await fetch(`https://graph.instagram.com/${IG_GRAPH_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  console.log("[instagram-publish-media] Publish response:", JSON.stringify(data));

  if (data.error || !data.id) {
    const errMsg = (data.error as Record<string, unknown>)?.message as string || "Failed to publish media";
    throw new Error(errMsg);
  }

  return data.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const userId = await verifyUser(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { media_type, media_url, caption = "", publish_target = "feed" } = body;

  // Validate inputs
  if (!media_type || !["image", "video", "reel"].includes(media_type)) {
    return jsonResponse({ error: "media_type must be image, video, or reel" }, 400);
  }
  if (!media_url || !media_url.startsWith("https://")) {
    return jsonResponse({ error: "media_url must be a public HTTPS URL" }, 400);
  }

  // Load user's active Instagram account
  const { data: igAccount, error: accountErr } = await supabase
    .from("user_instagram_accounts")
    .select("id, instagram_user_id, instagram_username, access_token, token_expires_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (accountErr || !igAccount) {
    return jsonResponse({ error: "No connected Instagram account found. Please connect Instagram first." }, 400);
  }

  // Check token expiry
  if (igAccount.token_expires_at) {
    const expiresAt = new Date(igAccount.token_expires_at).getTime();
    if (Date.now() > expiresAt) {
      return jsonResponse({ error: "Instagram token expired. Please reconnect your Instagram account." }, 400);
    }
  }

  // Create publish job record
  const { data: job, error: jobErr } = await supabase
    .from("instagram_publish_jobs")
    .insert({
      user_id: userId,
      instagram_account_id: igAccount.id,
      media_type,
      publish_target,
      source_media_url: media_url,
      caption: caption || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("[instagram-publish-media] Job insert error:", jobErr);
    return jsonResponse({ error: "Failed to create publish job" }, 500);
  }

  const jobId = job.id;

  try {
    // ── Step 1: Create media container
    const creationId = await createMediaContainer({
      igUserId: igAccount.instagram_user_id,
      accessToken: igAccount.access_token,
      mediaType: media_type,
      mediaUrl: media_url,
      caption,
      publishTarget: publish_target,
    });

    // Update job with creation_id
    await supabase
      .from("instagram_publish_jobs")
      .update({ instagram_creation_id: creationId, status: "processing", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    // ── Step 2: For images, publish immediately. For video/Reel, check status first.
    if (media_type === "image") {
      // Images are usually ready immediately
      const mediaId = await publishContainer(igAccount.instagram_user_id, creationId, igAccount.access_token);

      await supabase
        .from("instagram_publish_jobs")
        .update({ instagram_media_id: mediaId, status: "published", updated_at: new Date().toISOString() })
        .eq("id", jobId);

      console.log(`[instagram-publish-media] Image published: mediaId=${mediaId} for user=${userId}`);
      return jsonResponse({ success: true, job_id: jobId, instagram_media_id: mediaId, status: "published" });

    } else {
      // Video/Reel: check status — may need polling via instagram-publish-status
      const containerStatus = await checkContainerStatus(creationId, igAccount.access_token);

      if (containerStatus === "FINISHED") {
        // Ready to publish immediately
        const mediaId = await publishContainer(igAccount.instagram_user_id, creationId, igAccount.access_token);

        await supabase
          .from("instagram_publish_jobs")
          .update({ instagram_media_id: mediaId, status: "published", updated_at: new Date().toISOString() })
          .eq("id", jobId);

        console.log(`[instagram-publish-media] Video/Reel published: mediaId=${mediaId} for user=${userId}`);
        return jsonResponse({ success: true, job_id: jobId, instagram_media_id: mediaId, status: "published" });

      } else if (containerStatus === "ERROR" || containerStatus === "EXPIRED") {
        throw new Error(`Video container failed with status: ${containerStatus}`);
      } else {
        // Still processing — frontend should poll instagram-publish-status
        console.log(`[instagram-publish-media] Video processing: creation_id=${creationId} status=${containerStatus}`);
        return jsonResponse({
          success: true,
          job_id: jobId,
          instagram_creation_id: creationId,
          status: "processing",
          message: "Video is processing. Poll instagram-publish-status to check when ready.",
        });
      }
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram-publish-media] Publish error:", message);

    await supabase
      .from("instagram_publish_jobs")
      .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    return jsonResponse({ error: message, job_id: jobId }, 500);
  }
});
