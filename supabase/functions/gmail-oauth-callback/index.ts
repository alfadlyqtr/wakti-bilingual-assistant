import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Gmail OAuth Callback Edge Function
 *
 * Handles three flows:
 *
 * GET  /gmail-oauth-callback
 *   → Returns whether user has a connected Gmail account
 *
 * POST /gmail-oauth-callback  { action: "exchange_code", code, redirect_uri }
 *   → Exchanges code for access + refresh tokens
 *   → Fetches user's Gmail email from Google UserInfo API
 *   → Stores tokens in gmail_tokens (upsert)
 *   → Returns email info to frontend
 *
 * POST /gmail-oauth-callback  { action: "disconnect" }
 *   → Removes the user's Gmail token row
 *
 * POST /gmail-oauth-callback  { action: "check_connection" }
 *   → Returns whether user has a connected Gmail account
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  console.log("[gmail] exchangeCodeForTokens — redirect_uri:", redirectUri);
  console.log("[gmail] client_id present:", !!GOOGLE_CLIENT_ID);
  console.log("[gmail] client_secret present:", !!GOOGLE_CLIENT_SECRET);

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
  console.log("[gmail] Google token response status:", res.status);
  if (data.error) {
    console.error("[gmail] Google token error:", data.error, "|", data.error_description);
    throw new Error(data.error_description || data.error);
  }
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

function isReconnectRequiredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /invalid_grant|expired or revoked|token has been expired or revoked|revoked/i.test(message);
}

async function clearGmailTokens(supabase: ReturnType<typeof createClient>, userId: string) {
  await supabase
    .from("gmail_tokens")
    .delete()
    .eq("user_id", userId);
}

async function validateGmailConnection(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from("gmail_tokens")
    .select("access_token, refresh_token, email_address, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { connected: false as const };
  }

  let activeToken = data.access_token;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  const needsRefresh = expiresAt - Date.now() < 5 * 60 * 1000;

  if (needsRefresh) {
    if (!data.refresh_token) {
      await clearGmailTokens(supabase, userId);
      return { connected: false as const, reconnect_required: true };
    }

    try {
      const refreshed = await refreshAccessToken(data.refresh_token);
      activeToken = refreshed.access_token;
      await supabase
        .from("gmail_tokens")
        .update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", userId);
    } catch (refreshError) {
      console.error("Silent refresh failed:", refreshError);
      if (isReconnectRequiredError(refreshError)) {
        await clearGmailTokens(supabase, userId);
        return { connected: false as const, reconnect_required: true };
      }
      throw refreshError;
    }
  }

  const liveEmail = await fetchUserEmail(activeToken);
  if (!liveEmail) {
    await clearGmailTokens(supabase, userId);
    return { connected: false as const, reconnect_required: true };
  }

  if (liveEmail !== data.email_address) {
    await supabase
      .from("gmail_tokens")
      .update({ email_address: liveEmail })
      .eq("user_id", userId);
  }

  return {
    connected: true as const,
    email_address: liveEmail,
  };
}

async function fetchUserEmail(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (data.error) return null;
  return (data.email as string) || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── GET: check connection ───
    if (req.method === "GET") {
      const userId = await verifyUser(req);
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      return jsonResponse(await validateGmailConnection(supabase, userId));
    }

    // ─── DELETE: remove connection ───
    if (req.method === "DELETE") {
      const userId = await verifyUser(req);
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error: deleteErr } = await supabase
        .from("gmail_tokens")
        .delete()
        .eq("user_id", userId);

      if (deleteErr) {
        return jsonResponse({ error: "Failed to disconnect Gmail account" }, 500);
      }
      return jsonResponse({ success: true, message: "Gmail account disconnected" });
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
        return jsonResponse(await validateGmailConnection(supabase, userId));
      }

      // ── exchange_code ──
      if (action === "exchange_code") {
        const { code, redirect_uri } = body;
        if (!code || !redirect_uri) {
          return jsonResponse({ error: "Missing code or redirect_uri" }, 400);
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, redirect_uri);

        // Fetch the user's Gmail email address
        const emailAddress = await fetchUserEmail(tokens.access_token);

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Determine account_type: primary if no accounts exist yet, secondary otherwise
        const { data: existingAccounts } = await supabase
          .from("gmail_tokens")
          .select("account_type, refresh_token")
          .eq("user_id", userId);

        const hasPrimary = existingAccounts?.some((r: any) => r.account_type === "primary");
        const accountType: "primary" | "secondary" = hasPrimary ? "secondary" : "primary";

        // Preserve any existing refresh_token for this account_type if Google didn't return a new one
        let refreshTokenToStore: string | null = tokens.refresh_token ?? null;
        if (!refreshTokenToStore) {
          const existingForType = existingAccounts?.find((r: any) => r.account_type === accountType);
          if (existingForType?.refresh_token) {
            refreshTokenToStore = existingForType.refresh_token as string;
          }
        }

        // Upsert into gmail_tokens — one row per (user_id, account_type)
        const { error: upsertErr } = await supabase
          .from("gmail_tokens")
          .upsert(
            {
              user_id: userId,
              account_type: accountType,
              access_token: tokens.access_token,
              refresh_token: refreshTokenToStore,
              expires_at: expiresAt,
              email_address: emailAddress,
            },
            { onConflict: "user_id,account_type" }
          );

        if (upsertErr) {
          console.error("Failed to store Gmail tokens:", upsertErr);
          return jsonResponse({ error: "Failed to save Gmail connection" }, 500);
        }

        return jsonResponse({
          success: true,
          email_address: emailAddress,
          account_type: accountType,
        });
      }

      // ── disconnect ──
      if (action === "disconnect") {
        const { error: deleteErr } = await supabase
          .from("gmail_tokens")
          .delete()
          .eq("user_id", userId);

        if (deleteErr) {
          return jsonResponse({ error: "Failed to disconnect Gmail account" }, 500);
        }
        return jsonResponse({ success: true, message: "Gmail account disconnected" });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    console.error("gmail-oauth-callback error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
