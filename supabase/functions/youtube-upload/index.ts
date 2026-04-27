import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * YouTube Upload Edge Function
 *
 * POST /youtube-upload
 * Body:
 *   {
 *     file_url: string,        // Publicly accessible URL of the video/audio file
 *     title: string,           // Video title on YouTube
 *     description?: string,    // Optional description
 *     tags?: string[],         // Optional tags array
 *     privacy?: "public" | "private" | "unlisted",  // default: "public"
 *     is_short?: boolean,      // Hint that this should be treated as a YouTube Short
 *   }
 *
 * Returns:
 *   { success: true, video_id: string, video_url: string }
 *   or { error: string }
 *
 * Flow:
 *   1. Verify Supabase auth
 *   2. Load the user's access_token from user_youtube_tokens
 *   3. Auto-refresh if expired
 *   4. Fetch the file from file_url
 *   5. Upload to YouTube using resumable upload API
 *   6. Return the YouTube video ID + URL
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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

class YouTubeReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeReconnectRequiredError";
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) {
    // invalid_grant = refresh token revoked/expired/invalid. User must reconnect.
    if (data.error === "invalid_grant") {
      throw new YouTubeReconnectRequiredError(
        data.error_description || "YouTube token has been expired or revoked. Please reconnect your YouTube account."
      );
    }
    throw new Error(data.error_description || data.error);
  }
  return data;
}

async function deleteYouTubeTokens(userId: string): Promise<void> {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_youtube_tokens?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "return=minimal",
        },
      }
    );
  } catch (e) {
    console.error("Failed to delete stale YouTube tokens:", e);
  }
}

interface YouTubeTokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

// deno-lint-ignore no-explicit-any
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient<any>>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("user_youtube_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("YouTube account not connected. Please connect your YouTube account first.");
  }

  const row = data as unknown as YouTubeTokenRow;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const isExpired = expiresAt - Date.now() < 2 * 60 * 1000; // refresh if <2 min left

  if (isExpired) {
    if (!row.refresh_token) {
      throw new YouTubeReconnectRequiredError("YouTube token expired and no refresh token available. Please reconnect your YouTube account.");
    }
    const refreshed = await refreshAccessToken(row.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await fetch(
      `${SUPABASE_URL}/rest/v1/user_youtube_tokens?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ access_token: refreshed.access_token, expires_at: newExpiresAt }),
      }
    );

    return refreshed.access_token;
  }

  return row.access_token;
}

async function initiateResumableUpload(
  accessToken: string,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    privacy: string;
    madeForKids: boolean;
  },
  contentType: string,
  contentLength: number
): Promise<string> {
  const metadataBody = JSON.stringify({
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22", // People & Blogs — reasonable default for AI-generated content
    },
    status: {
      privacyStatus: metadata.privacy,
      selfDeclaredMadeForKids: metadata.madeForKids,
    },
  });

  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": contentLength.toString(),
      },
      body: metadataBody,
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 401) {
      throw new YouTubeReconnectRequiredError(`YouTube rejected access token. Please reconnect your YouTube account. ${errBody}`);
    }
    throw new Error(`Failed to initiate YouTube upload: ${res.status} ${errBody}`);
  }

  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube did not return a resumable upload URL");
  return uploadUrl;
}

async function uploadFileToYouTube(
  uploadUrl: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": fileData.byteLength.toString(),
    },
    body: fileData,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`YouTube upload failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();
  if (!data.id) throw new Error("YouTube upload succeeded but no video ID returned");
  return data.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let capturedUserId: string | null = null;

  try {
    const userId = await verifyUser(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);
    capturedUserId = userId;

    const body = await req.json();
    const {
      file_url,
      title,
      description = "",
      tags = [],
      privacy = "public",
      is_short = false,
      audience = "not_made_for_kids",
    } = body;

    if (!file_url) return jsonResponse({ error: "Missing file_url" }, 400);
    if (!title) return jsonResponse({ error: "Missing title" }, 400);

    const validPrivacy = ["public", "private", "unlisted"];
    if (!validPrivacy.includes(privacy)) {
      return jsonResponse({ error: "Invalid privacy value. Must be public, private, or unlisted." }, 400);
    }

    const validAudience = ["made_for_kids", "not_made_for_kids"];
    if (!validAudience.includes(audience)) {
      return jsonResponse({ error: "Invalid audience value. Must be made_for_kids or not_made_for_kids." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get a valid (possibly refreshed) access token
    const accessToken = await getValidAccessToken(supabase, userId);

    // Fetch the video file from storage URL
    console.log(`Fetching file from: ${file_url}`);
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) {
      return jsonResponse({ error: `Failed to fetch file from URL: ${fileRes.status}` }, 400);
    }

    const contentType = fileRes.headers.get("content-type") || "video/mp4";
    const fileData = await fileRes.arrayBuffer();
    const contentLength = fileData.byteLength;

    console.log(`File size: ${contentLength} bytes, type: ${contentType}`);

    // Add #Shorts to description/title hint if is_short flag is set
    const finalTitle = is_short && !title.includes("#Shorts")
      ? `${title} #Shorts`
      : title;

    const finalDescription = is_short && !description.includes("#Shorts")
      ? `${description}\n\n#Shorts`
      : description;

    // Step 1: Initiate resumable upload session
    const uploadUrl = await initiateResumableUpload(
      accessToken,
      {
        title: finalTitle,
        description: finalDescription,
        tags,
        privacy,
        madeForKids: audience === "made_for_kids",
      },
      contentType,
      contentLength
    );

    // Step 2: Upload the actual file bytes
    const videoId = await uploadFileToYouTube(uploadUrl, fileData, contentType);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Successfully uploaded video: ${videoUrl}`);

    return jsonResponse({
      success: true,
      video_id: videoId,
      video_url: videoUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("youtube-upload error:", message);
    if (err instanceof YouTubeReconnectRequiredError) {
      // Clear stale tokens so the UI reflects disconnected state.
      if (capturedUserId) {
        await deleteYouTubeTokens(capturedUserId);
      }
      return jsonResponse({ error: message, reconnect_required: true }, 401);
    }
    return jsonResponse({ error: message }, 500);
  }
});
