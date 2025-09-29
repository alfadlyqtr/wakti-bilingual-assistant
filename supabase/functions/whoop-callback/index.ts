import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function exchangeCodeForTokens(params: {
  code: string;
  redirect_uri: string;
  client_id: string;
  client_secret: string;
}) {
  const payload = new URLSearchParams();
  payload.set("grant_type", "authorization_code");
  payload.set("code", params.code);
  payload.set("redirect_uri", params.redirect_uri);
  payload.set("client_id", params.client_id);
  payload.set("client_secret", params.client_secret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return await res.json();
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const whoopClientId = Deno.env.get("WHOOP_CLIENT_ID");
    const whoopClientSecret = Deno.env.get("WHOOP_CLIENT_SECRET");
    if (!whoopClientId || !whoopClientSecret) {
      return new Response(JSON.stringify({ error: "Missing WHOOP client credentials" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prefer user JWT from request body.user_token; then x-supabase-authorization; then Authorization
    let userAuthHeader =
      req.headers.get("x-supabase-authorization") ||
      req.headers.get("Authorization") ||
      "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: {} },
    });

    // Read body once here so we can access user_token and reuse later
    const body = await req.json().catch(() => ({} as any));
    const bodyToken: string | undefined = (body as any)?.user_token;
    if (bodyToken && bodyToken.length > 0) {
      userAuthHeader = `Bearer ${bodyToken}`;
    }
    if (!userAuthHeader) {
      console.warn("whoop-callback: missing user auth (no user_token and no headers)");
      return new Response(JSON.stringify({ error: "unauthorized", detail: "missing_user_auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Extract bare token if header includes Bearer prefix
    const bareToken = userAuthHeader.startsWith("Bearer ")
      ? userAuthHeader.substring(7)
      : userAuthHeader;

    // Prefer extracting user id from JWT claims for robustness
    let userId: string | null = null;
    try {
      const parts = bareToken.split(".");
      if (parts.length === 3) {
        const payloadRaw = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadRaw);
        userId = payload?.sub || null;
      }
    } catch (_) {
      // fall back to getUser
    }

    if (!userId) {
      // Pass token explicitly to getUser for maximum compatibility
      const { data: userData, error: userErr } = await supabase.auth.getUser(bareToken);
      if (userErr || !userData?.user) {
        console.warn("whoop-callback: getUser failed", { hasError: !!userErr, message: userErr?.message });
        return new Response(JSON.stringify({ error: "unauthorized", detail: userErr?.message || "no_user" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = userData.user.id;
    }

    const { code, redirect_uri, state } = (body as any) || {};
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optionally verify state here if you persist it server-side; currently echoed back
    if (!state) {
      // proceed but log missing state
      console.warn("whoop-callback: no state provided by client");
    }

    const tokenRes = await exchangeCodeForTokens({
      code,
      redirect_uri,
      client_id: whoopClientId,
      client_secret: whoopClientSecret,
    });

    const access_token: string = tokenRes.access_token;
    const refresh_token: string = tokenRes.refresh_token;
    const expires_in: number = tokenRes.expires_in;
    const scopeStr: string | undefined = tokenRes.scope;

    // Detailed logging after token exchange
    console.log('whoop-callback: Token exchange successful', {
      hasAccessToken: !!access_token,
      accessTokenLength: access_token?.length,
      accessTokenPrefix: access_token?.substring(0, 20),
      hasRefreshToken: !!refresh_token,
      expiresIn: expires_in,
      scope: scopeStr
    });

    if (!access_token || !refresh_token || !expires_in) {
      console.error("whoop-callback: incomplete token payload", tokenRes);
      return new Response(JSON.stringify({ error: "invalid_token_response" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();
    const scope = scopeStr ? scopeStr.split(" ") : [];

    const userScoped = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bareToken}` } },
    });

    const admin = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : userScoped;

    // Ensure a profiles row exists for this user to satisfy FK constraints
    const { data: existingProfile, error: profileSelectErr } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (profileSelectErr) {
      console.warn("whoop-callback: profile select error", profileSelectErr.message);
    }
    if (!existingProfile) {
      const { error: profileInsertErr } = await admin
        .from("profiles")
        .insert({ id: userId });
      if (profileInsertErr) {
        console.error("whoop-callback: profile insert failed", profileInsertErr.message);
        return new Response(JSON.stringify({ error: "db_error", detail: `profile_insert_failed: ${profileInsertErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Log prior to storing tokens
    console.log('whoop-callback: About to store tokens', {
      userId,
      accessTokenLength: access_token.length,
      hasRefreshToken: !!refresh_token,
      expiresAt: expires_at
    });

    const { error: upsertErr } = await admin
      .from("user_whoop_tokens")
      .upsert(
        [{
          user_id: userId,
          access_token,
          refresh_token,
          expires_at,
          scope,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: "user_id" }
      );

    if (upsertErr) {
      console.error("whoop-callback upsert error", upsertErr);
      return new Response(JSON.stringify({ error: "db_error", detail: upsertErr.message || String(upsertErr) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whoop-callback error", e);
    return new Response(JSON.stringify({ error: "internal_error", detail: (e as any)?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

