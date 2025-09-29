import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";

// WHOOP requires state to be exactly 8 characters
function randomState(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const clientId = Deno.env.get("WHOOP_CLIENT_ID");
    if (!clientId) {
      console.error("whoop-auth-start: WHOOP_CLIENT_ID missing");
      return new Response(JSON.stringify({ error: "missing_client_id" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const requestedRedirect = body?.redirect_uri as string | undefined;
    const envRedirect = Deno.env.get("WHOOP_REDIRECT_URI");
    const redirectUri = requestedRedirect || envRedirect;
    if (!redirectUri) {
      console.error("whoop-auth-start: redirect_uri missing");
      return new Response(JSON.stringify({ error: "missing_redirect_uri", detail: "Pass redirect_uri in body or set WHOOP_REDIRECT_URI" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scopes = [
      "offline",
      "read:sleep",
      "read:recovery",
      "read:workout",
      "read:cycles",
      "read:profile",
      "read:body_measurement",
    ];

    const state = randomState(8);
    const url = new URL(WHOOP_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);

    return new Response(JSON.stringify({ authorize_url: url.toString(), state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("whoop-auth-start error", e?.message || String(e));
    return new Response(JSON.stringify({ error: "internal_error", detail: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

