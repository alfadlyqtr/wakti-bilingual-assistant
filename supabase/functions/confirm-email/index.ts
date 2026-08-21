/**
 * Confirm Email — marks a profile's email as confirmed when the user clicks
 * the link from the welcome email.
 *
 * The link points to the app's /confirm-email?page with ?token=..., and the
 * page POSTs the token here. The token is single-use: cleared on success.
 * Service role does the write; the token itself is the proof of ownership.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hxauxozopvpzpdygoqwf.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "not allowed" }, 400);

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch { /* handled below */ }

  // Tokens are UUIDs — anything else is rejected before touching the DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return json({ ok: false, error: "invalid token" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profile, error: findError } = await admin
    .from("profiles")
    .select("id")
    .eq("email_confirm_token", token)
    .maybeSingle();

  if (findError || !profile) {
    return json({ ok: false, error: "invalid or expired link" }, 404);
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ email_confirmed: true, email_confirm_token: null })
    .eq("id", profile.id);

  if (updateError) {
    console.error("[confirm-email] update failed:", updateError.message);
    return json({ ok: false, error: "update failed" }, 500);
  }

  console.log(`[confirm-email] confirmed profile ${profile.id}`);
  return json({ ok: true });
});
