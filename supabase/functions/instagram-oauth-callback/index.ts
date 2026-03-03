import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Instagram OAuth Callback Edge Function
 * 
 * Flow:
 * 1. User clicks "Connect Instagram" → redirected to Meta OAuth
 * 2. Meta redirects back here with ?code=...&state=...
 * 3. We exchange code for short-lived token
 * 4. Exchange short-lived → long-lived token
 * 5. Fetch user's Facebook Pages
 * 6. For each Page, fetch connected Instagram Business Account
 * 7. Return page list to frontend (user picks one)
 * 
 * OR if ?action=select_page, store the chosen page+IG account on the bot.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

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
    headers: { ...corsHeaders, Location: url },
  });
}

// Verify Supabase auth token and return user_id
async function verifyUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// Exchange authorization code for short-lived token
async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{ access_token: string; token_type: string }> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Token exchange failed");
  return data;
}

// Exchange short-lived token for long-lived token (60 days)
async function getLongLivedToken(shortToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Long-lived token exchange failed");
  return data.access_token;
}

// Fetch Facebook Pages the user manages
async function fetchPages(accessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch pages");
  return data.data || [];
}

// Fetch Instagram Business Account details
async function fetchIGAccount(igAccountId: string, pageAccessToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}?fields=id,name,username,profile_picture_url,followers_count&access_token=${pageAccessToken}`
  );
  const data = await res.json();
  if (data.error) return null;
  return data;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ─── ACTION: exchange_code ───
    // Called by frontend after Meta redirects back with ?code=
    if (req.method === "POST") {
      const body = await req.json();
      const { action: bodyAction } = body;

      // Verify user
      const userId = await verifyUser(req);
      if (!userId) return jsonResponse({ error: "Unauthorized" }, 401);

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      if (bodyAction === "exchange_code") {
        const { code, redirect_uri, bot_id } = body;
        if (!code || !redirect_uri || !bot_id) {
          return jsonResponse({ error: "Missing code, redirect_uri, or bot_id" }, 400);
        }

        // Verify the bot belongs to this user (NO CROSS-USER)
        const { data: bot, error: botErr } = await supabase
          .from("chatbot_bots")
          .select("id, user_id")
          .eq("id", bot_id)
          .single();

        if (botErr || !bot) return jsonResponse({ error: "Bot not found" }, 404);
        if (bot.user_id !== userId) return jsonResponse({ error: "Forbidden: bot does not belong to you" }, 403);

        // 1. Exchange code for short-lived token
        const tokenData = await exchangeCodeForToken(code, redirect_uri);

        // 2. Exchange for long-lived token
        const longLivedToken = await getLongLivedToken(tokenData.access_token);

        // 3. Fetch user's Facebook Pages (with IG business accounts)
        const pages = await fetchPages(longLivedToken);

        // 4. For each page, fetch IG account details
        const pagesWithIG = await Promise.all(
          pages.map(async (page: any) => {
            let igAccount = null;
            if (page.instagram_business_account?.id) {
              igAccount = await fetchIGAccount(page.instagram_business_account.id, page.access_token);
            }
            return {
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
              ig_account: igAccount
                ? {
                    id: igAccount.id,
                    username: igAccount.username || null,
                    name: igAccount.name || page.name,
                    profile_picture_url: igAccount.profile_picture_url || null,
                    followers_count: igAccount.followers_count || 0,
                  }
                : null,
            };
          })
        );

        // Return pages to frontend — user will pick one
        return jsonResponse({
          success: true,
          long_lived_token: longLivedToken,
          pages: pagesWithIG,
        });
      }

      if (bodyAction === "select_page") {
        const { bot_id, page_id, page_name, page_access_token, ig_account_id, long_lived_token } = body;
        if (!bot_id || !page_id) {
          return jsonResponse({ error: "Missing bot_id or page_id" }, 400);
        }

        // Verify the bot belongs to this user (NO CROSS-USER)
        const { data: bot, error: botErr } = await supabase
          .from("chatbot_bots")
          .select("id, user_id")
          .eq("id", bot_id)
          .single();

        if (botErr || !bot) return jsonResponse({ error: "Bot not found" }, 404);
        if (bot.user_id !== userId) return jsonResponse({ error: "Forbidden: bot does not belong to you" }, 403);

        // Store IG connection on the bot
        const tokenToStore = page_access_token || long_lived_token;
        const { error: updateErr } = await supabase
          .from("chatbot_bots")
          .update({
            instagram_page_id: page_id,
            instagram_page_name: page_name || null,
            instagram_access_token: tokenToStore,
            instagram_business_account_id: ig_account_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bot_id)
          .eq("user_id", userId); // extra safety

        if (updateErr) {
          console.error("Failed to update bot:", updateErr);
          return jsonResponse({ error: "Failed to save Instagram connection" }, 500);
        }

        // Subscribe the Facebook Page to the app's webhooks so DMs are forwarded
        let subscribeResult: unknown = null;
        try {
          const subRes = await fetch(
            `https://graph.facebook.com/v21.0/${page_id}/subscribed_apps`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscribed_fields: ["messages", "messaging_postbacks", "messaging_optins", "messaging_referrals"],
                access_token: tokenToStore,
              }),
            }
          );
          subscribeResult = await subRes.json();
          console.log("Page webhook subscription result:", JSON.stringify(subscribeResult));
        } catch (subErr: any) {
          console.error("Failed to subscribe page to webhooks:", subErr.message);
          subscribeResult = { error: subErr.message };
        }

        return jsonResponse({ success: true, message: "Instagram account connected to bot", webhook_subscription: subscribeResult });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    // ─── GET: OAuth redirect landing (browser redirect from Meta) ───
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      // Parse state to get bot_id and origin
      let stateData: { bot_id?: string; origin?: string } = {};
      if (state) {
        try {
          stateData = JSON.parse(atob(state));
        } catch {
          stateData = {};
        }
      }

      const origin = stateData.origin || "https://wakti.qa";
      const botId = stateData.bot_id || "";

      if (error) {
        // User denied or error occurred — redirect back with error
        return redirectResponse(`${origin}/projects?ig_error=${encodeURIComponent(errorDescription || error)}&bot_id=${botId}`);
      }

      if (!code) {
        return redirectResponse(`${origin}/projects?ig_error=no_code&bot_id=${botId}`);
      }

      // Redirect back to frontend with the code — frontend will call POST to exchange
      return redirectResponse(`${origin}/projects?ig_code=${encodeURIComponent(code)}&bot_id=${botId}`);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    console.error("instagram-oauth-callback error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
