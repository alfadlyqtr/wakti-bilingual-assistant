import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wakti-rc-secret"
};
const SECRET_HEADER = "x-wakti-rc-secret";
function isActivationEvent(type: string) {
  const t = type?.toLowerCase?.() ?? "";
  return t.includes("initial_purchase") || t.includes("renewal") || t.includes("product_change") || t.includes("uncancellation") || t.includes("non_renewing_purchase");
}
function isDeactivationEvent(type: string) {
  const t = type?.toLowerCase?.() ?? "";
  return t.includes("expiration") || t.includes("cancel");
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const providedHeader = req.headers.get(SECRET_HEADER) || "";
    const authHeader = req.headers.get("authorization") || ""; // e.g. "Bearer <token>"
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const authorized = Boolean(expected && (providedHeader === expected || bearer === expected));
    if (!authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const body = await req.json().catch(() => ({}));
    const event = body.event || body || {};
    const type = String(event.type || body.type || "");
    const appUserId = String(event.app_user_id || body.app_user_id || event.appUserId || body.appUserId || "");
    const rcCustomerId = event.customer_info?.id || body.customer_info?.id || event.customer_id || body.customer_id || null;
    if (!appUserId) {
      return new Response(JSON.stringify({ error: "missing app_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const activate = isActivationEvent(type);
    const deactivate = isDeactivationEvent(type);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (activate) updatePayload["is_subscribed"] = true;
    if (deactivate) updatePayload["is_subscribed"] = false;
    if (rcCustomerId) updatePayload["revenuecat_id"] = rcCustomerId;
    if (Object.keys(updatePayload).length > 1) {
      const { error: upErr } = await supabase.from("profiles").update(updatePayload).eq("id", appUserId);
      if (upErr) {
        console.error("profiles update error", upErr);
        return new Response(JSON.stringify({ error: "db_update_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }
    return new Response(JSON.stringify({ ok: true, type, appUserId, changed: Object.keys(updatePayload) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("revenuecat-webhook error", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
