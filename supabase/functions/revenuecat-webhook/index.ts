import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wakti-rc-secret"
};

const SECRET_HEADER = "x-wakti-rc-secret";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authorize request
    const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const providedHeader = req.headers.get(SECRET_HEADER) || "";
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const authorized = Boolean(expected && (providedHeader === expected || bearer === expected));
    
    if (!authorized) {
      console.error("[revenuecat-webhook] Unauthorized request");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const event = body.event || body || {};
    const type = String(event.type || body.type || "");
    const appUserId = String(event.app_user_id || body.app_user_id || event.appUserId || body.appUserId || "");
    const rcCustomerId = event.customer_info?.id || body.customer_info?.id || event.customer_id || body.customer_id || null;
    
    // For TRANSFER events, get the transferred_to IDs
    const transferredTo: string[] = event.transferred_to || body.transferred_to || [];
    
    // Redact IDs in logs for security
    const appUserIdShort = appUserId ? appUserId.substring(0, 8) + '...' : 'none';
    console.log(`[revenuecat-webhook] Event: ${type}, appUserId: ${appUserIdShort}`);
    
    if (!appUserId && transferredTo.length === 0) {
      return new Response(JSON.stringify({ error: "missing app_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const activate = isActivationEvent(type);
    const deactivate = isDeactivationEvent(type);
    const isTransfer = type.toLowerCase().includes("transfer");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Build update payload
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (activate || isTransfer) updatePayload["is_subscribed"] = true;
    if (deactivate) updatePayload["is_subscribed"] = false;
    if (rcCustomerId) updatePayload["revenuecat_id"] = rcCustomerId;

    // Skip if nothing meaningful to update
    if (Object.keys(updatePayload).length <= 1) {
      return new Response(JSON.stringify({ ok: true, type, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Collect all possible user IDs to try (prioritize UUIDs)
    const idsToTry: string[] = [];
    
    // For TRANSFER events, use transferred_to IDs
    if (isTransfer && transferredTo.length > 0) {
      // Add UUID IDs first (Supabase user IDs)
      transferredTo.filter(id => UUID_REGEX.test(id)).forEach(id => idsToTry.push(id));
      // Then add other IDs
      transferredTo.filter(id => !UUID_REGEX.test(id)).forEach(id => idsToTry.push(id));
    }
    
    // Add appUserId
    if (appUserId && UUID_REGEX.test(appUserId)) {
      if (!idsToTry.includes(appUserId)) idsToTry.unshift(appUserId);
    } else if (appUserId) {
      if (!idsToTry.includes(appUserId)) idsToTry.push(appUserId);
    }

    let updated = false;
    let updatedUserId = "";

    // Get UUID IDs to check
    const uuidIds = idsToTry.filter(id => UUID_REGEX.test(id));
    
    // Optimized Strategy: Fetch matching profiles first, then update once
    // This reduces N+1 queries to at most 3 queries
    
    // Strategy 1: Try to find profile by Supabase user ID (UUID format)
    if (uuidIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .in("id", uuidIds)
        .limit(1);
      
      if (profiles && profiles.length > 0) {
        const targetId = profiles[0].id;
        const { error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", targetId);
        
        if (!error) {
          updated = true;
          updatedUserId = targetId;
          console.log(`[revenuecat-webhook] Updated profile by id: ${targetId.substring(0, 8)}...`);
        }
      }
    }

    // Strategy 2: Try to find profile by revenuecat_id
    if (!updated && idsToTry.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .in("revenuecat_id", idsToTry)
        .limit(1);
      
      if (profiles && profiles.length > 0) {
        const targetId = profiles[0].id;
        const { error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", targetId);
        
        if (!error) {
          updated = true;
          updatedUserId = targetId;
          console.log(`[revenuecat-webhook] Updated profile by revenuecat_id lookup`);
        }
      }
    }

    // Strategy 3: Try rcCustomerId if still not updated
    if (!updated && rcCustomerId) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("revenuecat_id", rcCustomerId)
        .limit(1);
      
      if (profiles && profiles.length > 0) {
        const targetId = profiles[0].id;
        const { error } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", targetId);
        
        if (!error) {
          updated = true;
          updatedUserId = targetId;
          console.log(`[revenuecat-webhook] Updated profile by rcCustomerId lookup`);
        }
      }
    }

    if (!updated) {
      console.warn(`[revenuecat-webhook] No profile found for provided IDs`);
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      type, 
      appUserId, 
      updated,
      updatedUserId,
      changed: Object.keys(updatePayload) 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[revenuecat-webhook] Error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
