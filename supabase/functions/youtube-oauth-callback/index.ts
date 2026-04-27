import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * YouTube OAuth Callback Edge Function
 *
 * Handles two flows:
 *
 * GET  /youtube-oauth-callback?code=...&state=...
 *   → Google redirects here after user grants permission
 *   → Redirects browser back to frontend with ?yt_code=...&state=...
 *
 * POST /youtube-oauth-callback  { action: "exchange_code", code, redirect_uri }
 *   → Frontend calls this after receiving the code
 *   → Exchanges code for access + refresh tokens
 *   → Stores tokens in user_youtube_tokens (upsert)
 *   → Returns channel info to frontend
 *
 * POST /youtube-oauth-callback  { action: "disconnect" }
 *   → Removes the user's YouTube token row
 *
 * POST /youtube-oauth-callback  { action: "check_connection" }
 *   → Returns whether user has a connected YouTube account
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirectResponse(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
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

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
}

async function refreshAccessToken(refreshToken: string) {
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
  if (data.error) throw new Error(data.error_description || data.error);
  return data as { access_token: string; expires_in: number };
}

async function fetchChannelInfo(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (data.error) return null;
  const channel = data.items?.[0];
  if (!channel) return null;
  return {
    channel_id: channel.id as string,
    channel_title: channel.snippet?.title as string,
    channel_thumbnail: channel.snippet?.thumbnails?.default?.url as string | undefined,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ─── GET: Google redirects back here ───
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      let origin = "https://wakti.qa";
      if (state) {
        try {
          const decoded = JSON.parse(atob(state));
          if (decoded.origin) origin = decoded.origin;
        } catch { /* ignore */ }
      }

      if (error) {
        return redirectResponse(`${origin}/auth/google/callback?yt_error=${encodeURIComponent(error)}`);
      }
      if (!code) {
        return redirectResponse(`${origin}/auth/google/callback?yt_error=no_code`);
      }

      // Pass code + state to frontend — frontend will POST exchange_code
      return redirectResponse(
        `${origin}/auth/google/callback?yt_code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || "")}`
      );
    }

    // ─── POST actions ───
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      const userId = await verifyUser(req);
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // ── check_connection ──
      if (action === "check_connection") {
        const { data, error } = await supabase
          .from("user_youtube_tokens")
          .select("channel_id, channel_title, channel_thumbnail, expires_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (error || !data) return jsonResponse({ connected: false });

        // If token is about to expire (<5 min), try to refresh silently
        const { data: tokenRow } = await supabase
          .from("user_youtube_tokens")
          .select("refresh_token")
          .eq("user_id", userId)
          .single();

        const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
        const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000;

        if (needsRefresh && tokenRow?.refresh_token) {
          try {
            const refreshed = await refreshAccessToken(tokenRow.refresh_token);
            await supabase
              .from("user_youtube_tokens")
              .update({
                access_token: refreshed.access_token,
                expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              })
              .eq("user_id", userId);
          } catch (e) {
            console.error("Silent refresh failed:", e);
          }
        }

        return jsonResponse({
          connected: true,
          channel_id: data.channel_id,
          channel_title: data.channel_title,
          channel_thumbnail: data.channel_thumbnail,
        });
      }

      // ── exchange_code ──
      if (action === "exchange_code") {
        const { code, redirect_uri } = body;
        if (!code || !redirect_uri) {
          return jsonResponse({ error: "Missing code or redirect_uri" }, 400);
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, redirect_uri);

        // Fetch the user's YouTube channel info
        const channelInfo = await fetchChannelInfo(tokens.access_token);

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Preserve any existing refresh_token if Google didn't return a new one
        // (Google only returns refresh_token on first consent unless prompt=consent)
        let refreshTokenToStore: string | null = tokens.refresh_token ?? null;
        if (!refreshTokenToStore) {
          const { data: existing } = await supabase
            .from("user_youtube_tokens")
            .select("refresh_token")
            .eq("user_id", userId)
            .maybeSingle();
          if (existing?.refresh_token) {
            refreshTokenToStore = existing.refresh_token as string;
          }
        }

        // Upsert into user_youtube_tokens
        const { error: upsertErr } = await supabase
          .from("user_youtube_tokens")
          .upsert(
            {
              user_id: userId,
              access_token: tokens.access_token,
              refresh_token: refreshTokenToStore,
              expires_at: expiresAt,
              channel_id: channelInfo?.channel_id ?? null,
              channel_title: channelInfo?.channel_title ?? null,
              channel_thumbnail: channelInfo?.channel_thumbnail ?? null,
            },
            { onConflict: "user_id" }
          );

        if (upsertErr) {
          console.error("Failed to store YouTube tokens:", upsertErr);
          return jsonResponse({ error: "Failed to save YouTube connection" }, 500);
        }

        return jsonResponse({
          success: true,
          channel_id: channelInfo?.channel_id,
          channel_title: channelInfo?.channel_title,
          channel_thumbnail: channelInfo?.channel_thumbnail,
        });
      }

      // ── disconnect ──
      if (action === "disconnect") {
        const { error: deleteErr } = await supabase
          .from("user_youtube_tokens")
          .delete()
          .eq("user_id", userId);

        if (deleteErr) {
          return jsonResponse({ error: "Failed to disconnect YouTube account" }, 500);
        }
        return jsonResponse({ success: true, message: "YouTube account disconnected" });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    console.error("youtube-oauth-callback error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
