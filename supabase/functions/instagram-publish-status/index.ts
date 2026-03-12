import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * instagram-publish-status
 *
 * Polls the status of a video/Reel container and publishes it when ready.
 * Call this after instagram-publish-media returns status: "processing".
 *
 * POST body:
 *   job_id: UUID of the instagram_publish_jobs row
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const userId = await verifyUser(req);
  if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const body = await req.json().catch(() => ({})) as Record<string, string>;
  const { job_id } = body;

  if (!job_id) return jsonResponse({ error: "Missing job_id" }, 400);

  // Load the job — must belong to this user
  const { data: job, error: jobErr } = await supabase
    .from("instagram_publish_jobs")
    .select("id, status, instagram_creation_id, instagram_account_id, instagram_media_id, error_message")
    .eq("id", job_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (jobErr || !job) return jsonResponse({ error: "Job not found" }, 404);

  // Already done — return current state
  if (job.status === "published") {
    return jsonResponse({ status: "published", instagram_media_id: job.instagram_media_id, job_id });
  }
  if (job.status === "failed") {
    return jsonResponse({ status: "failed", error: job.error_message, job_id });
  }
  if (!job.instagram_creation_id) {
    return jsonResponse({ status: job.status, job_id });
  }

  // Load Instagram account token
  const { data: igAccount, error: accountErr } = await supabase
    .from("user_instagram_accounts")
    .select("instagram_user_id, access_token")
    .eq("id", job.instagram_account_id)
    .maybeSingle();

  if (accountErr || !igAccount) {
    return jsonResponse({ error: "Instagram account not found" }, 400);
  }

  try {
    // Check container status
    const statusRes = await fetch(
      `https://graph.instagram.com/${IG_GRAPH_VERSION}/${job.instagram_creation_id}?fields=status_code,status&access_token=${igAccount.access_token}`
    );
    const statusData = await statusRes.json() as Record<string, unknown>;
    console.log("[instagram-publish-status] Container status:", JSON.stringify(statusData));

    const statusCode = (statusData.status_code as string) || "IN_PROGRESS";

    if (statusCode === "FINISHED") {
      // Publish it now
      const publishRes = await fetch(
        `https://graph.instagram.com/${IG_GRAPH_VERSION}/${igAccount.instagram_user_id}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: job.instagram_creation_id,
            access_token: igAccount.access_token,
          }),
        }
      );
      const publishData = await publishRes.json() as Record<string, unknown>;
      console.log("[instagram-publish-status] Publish response:", JSON.stringify(publishData));

      if (publishData.error || !publishData.id) {
        const errMsg = (publishData.error as Record<string, unknown>)?.message as string || "Publish failed";
        throw new Error(errMsg);
      }

      const mediaId = publishData.id as string;

      await supabase
        .from("instagram_publish_jobs")
        .update({ instagram_media_id: mediaId, status: "published", updated_at: new Date().toISOString() })
        .eq("id", job_id);

      return jsonResponse({ status: "published", instagram_media_id: mediaId, job_id });

    } else if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const errMsg = `Container failed with status: ${statusCode}`;
      await supabase
        .from("instagram_publish_jobs")
        .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
        .eq("id", job_id);

      return jsonResponse({ status: "failed", error: errMsg, job_id });

    } else {
      // Still processing (IN_PROGRESS, etc.)
      return jsonResponse({ status: "processing", container_status: statusCode, job_id });
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram-publish-status] Error:", message);

    await supabase
      .from("instagram_publish_jobs")
      .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", job_id);

    return jsonResponse({ status: "failed", error: message, job_id }, 500);
  }
});
