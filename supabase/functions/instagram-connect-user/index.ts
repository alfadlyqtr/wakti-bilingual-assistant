import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * instagram-connect-user
 *
 * Handles Instagram OAuth for the media publishing feature.
 * SEPARATE from bot creation — stores connection in user_instagram_accounts.
 *
 * Actions:
 *   POST { action: "exchange_code", code, redirect_uri }  → exchange code, store token, return account info
 *   POST { action: "disconnect" }                         → remove user's Instagram connection
 *   GET  ?action=status                                   → check if user has active connection
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("METAA_APP_ID") || Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("METAA_APP_SECRET") || Deno.env.get("META_APP_SECRET")!;

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

async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

async function exchangeCodeForShortToken(code: string, redirectUri: string): Promise<{ access_token: string; user_id: string }> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });
  // New Instagram Business Login (2024+) uses graph.facebook.com for short-lived token
  const res = await fetch("https://graph.facebook.com/oauth/access_token", {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  console.log("[instagram-connect-user] Short token response:", JSON.stringify(data));
  if (data.error_type || data.error) {
    throw new Error(data.error_message || data.error?.message || "Short token exchange failed");
  }
  return { access_token: data.access_token, user_id: String(data.user_id) };
}

async function exchangeForLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number }> {
  // Facebook Login for Business: exchange FB user token for long-lived FB token
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`https://graph.facebook.com/oauth/access_token?${params}`);
  const data = await res.json();
  console.log("[instagram-connect-user] Long token response:", JSON.stringify(data));
  if (data.error) throw new Error(data.error.message || "Long-lived token exchange failed");
  return { access_token: data.access_token, expires_in: data.expires_in || 5183944 };
}

async function fetchIGUserInfo(fbAccessToken: string) {
  // Facebook Login for Business: get FB pages then their linked Instagram business accounts
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,name,username,profile_picture_url,followers_count}&access_token=${fbAccessToken}`
  );
  const pagesData = await pagesRes.json();
  console.log("[instagram-connect-user] FB pages response:", JSON.stringify(pagesData));
  if (pagesData.error) {
    console.error("[instagram-connect-user] FB pages error:", JSON.stringify(pagesData.error));
    return null;
  }
  // Find first page with a linked Instagram business account
  const pages = pagesData.data || [];
  for (const page of pages) {
    if (page.instagram_business_account) {
      const ig = page.instagram_business_account;
      return { id: ig.id, name: ig.name, username: ig.username, profile_picture_url: ig.profile_picture_url, followers_count: ig.followers_count };
    }
  }
  // Fallback: try /me directly for Instagram-linked FB user
  const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${fbAccessToken}`);
  const meData = await meRes.json();
  console.log("[instagram-connect-user] FB me response:", JSON.stringify(meData));
  if (meData.error || !meData.id) return null;
  return { id: meData.id, name: meData.name, username: null, profile_picture_url: null, followers_count: 0 };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const userId = await verifyUser(req);
    if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // GET: status check
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "status") {
        const { data, error } = await supabase
          .from("user_instagram_accounts")
          .select("id, instagram_username, instagram_name, profile_picture_url, followers_count, token_expires_at, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("[instagram-connect-user] Status check error:", JSON.stringify(error));
          return jsonResponse({ error: "DB error", detail: error.message }, 500);
        }

        return jsonResponse({ connected: !!data, account: data || null });
      }

      return jsonResponse({ error: "Unknown GET action" }, 400);
    }

    // POST: exchange_code or disconnect
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action } = body;

      // exchange_code
      if (action === "exchange_code") {
        const { code, redirect_uri } = body;
        if (!code || !redirect_uri) {
          return jsonResponse({ error: "Missing code or redirect_uri" }, 400);
        }

        try {
          // 1. Short-lived token
          const { access_token: shortToken, user_id: igUserId } = await exchangeCodeForShortToken(code, redirect_uri);

          // 2. Long-lived token (60 days)
          const { access_token: longToken, expires_in } = await exchangeForLongLivedToken(shortToken);

          // 3. Fetch IG account info
          const igUser = await fetchIGUserInfo(longToken);
          if (!igUser) throw new Error("Failed to fetch Instagram account info");

          // 4. Token expiry
          const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

          // 5. Upsert into user_instagram_accounts
          const { data: account, error: upsertErr } = await supabase
            .from("user_instagram_accounts")
            .upsert({
              user_id: userId,
              instagram_user_id: String(igUser.id || igUserId),
              instagram_username: igUser.username || null,
              instagram_name: igUser.name || igUser.username || null,
              profile_picture_url: igUser.profile_picture_url || null,
              followers_count: igUser.followers_count || 0,
              access_token: longToken,
              token_expires_at: tokenExpiresAt,
              scopes: "instagram_business_basic,instagram_business_content_publish",
              is_active: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,instagram_user_id" })
            .select("id, instagram_username, instagram_name, profile_picture_url, followers_count")
            .single();

          if (upsertErr) {
            console.error("[instagram-connect-user] Upsert error:", JSON.stringify(upsertErr));
            throw new Error("Failed to save Instagram connection: " + upsertErr.message);
          }

          console.log("[instagram-connect-user] Connected IG account @" + igUser.username + " for user " + userId);
          return jsonResponse({ success: true, account });

        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[instagram-connect-user] exchange_code error:", msg);
          return jsonResponse({ error: msg || "Failed to connect Instagram" }, 500);
        }
      }

      // disconnect
      if (action === "disconnect") {
        const { error: delErr } = await supabase
          .from("user_instagram_accounts")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (delErr) {
          console.error("[instagram-connect-user] Disconnect error:", JSON.stringify(delErr));
          return jsonResponse({ error: "Failed to disconnect" }, 500);
        }

        return jsonResponse({ success: true, message: "Instagram disconnected" });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (topErr: unknown) {
    const msg = topErr instanceof Error ? topErr.message : String(topErr);
    console.error("[instagram-connect-user] TOP LEVEL ERROR:", msg);
    return new Response(JSON.stringify({ error: "Internal error", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
