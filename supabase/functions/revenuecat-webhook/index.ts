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

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR REVENUECAT DATA MAPPING
// ═══════════════════════════════════════════════════════════════

// Map RevenueCat store to payment_method
function mapStoreToPaymentMethod(store: string): string {
  const s = store?.toUpperCase?.() ?? "";
  if (s.includes("APP_STORE") || s.includes("APPLE") || s.includes("IOS")) return "apple";
  if (s.includes("PLAY_STORE") || s.includes("GOOGLE") || s.includes("ANDROID")) return "google";
  if (s.includes("STRIPE")) return "stripe";
  if (s.includes("AMAZON")) return "amazon";
  return "iap"; // Generic IAP fallback
}

// Map product_id to plan name - WAKTI SPECIFIC PRODUCTS
function mapProductToPlanName(productId: string): string {
  const p = productId?.toLowerCase?.() ?? "";
  // Wakti specific products
  if (p.includes("qr.wakti.ai.monthly") || p.includes("wakti.ai.monthly")) return "Wakti Pro Monthly";
  if (p.includes("qr.wakti.ai.yearly") || p.includes("wakti.ai.yearly") || p.includes("annual")) return "Wakti Pro Yearly";
  if (p.includes("qr.wakti.ai.lifetime") || p.includes("wakti.ai.lifetime")) return "Wakti Pro Lifetime";
  // Generic fallbacks
  if (p.includes("yearly") || p.includes("annual")) return "Wakti Pro Yearly";
  if (p.includes("monthly")) return "Wakti Pro Monthly";
  if (p.includes("lifetime")) return "Wakti Pro Lifetime";
  if (p.includes("wakti") || p.includes("pro")) return "Wakti Pro";
  return "Wakti Pro"; // Default
}

// Determine billing cycle from product
function getBillingCycle(productId: string): string {
  const p = productId?.toLowerCase?.() ?? "";
  if (p.includes("yearly") || p.includes("annual")) return "yearly";
  if (p.includes("lifetime")) return "lifetime";
  return "monthly";
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
    
    // ═══════════════════════════════════════════════════════════════
    // EXTRACT FULL SUBSCRIPTION DATA FROM REVENUECAT WEBHOOK
    // ═══════════════════════════════════════════════════════════════
    const store = event.store || body.store || "";
    const productId = event.product_id || body.product_id || "";
    const price = event.price || body.price || event.price_in_purchased_currency || 0;
    const currency = event.currency || body.currency || event.purchased_currency || "USD";
    const purchasedAtMs = event.purchased_at_ms || body.purchased_at_ms || event.purchase_date_ms || Date.now();
    const expirationAtMs = event.expiration_at_ms || body.expiration_at_ms || event.expires_date_ms || null;
    
    // For TRANSFER events, get the transferred_to IDs
    const transferredTo: string[] = event.transferred_to || body.transferred_to || [];
    
    // Log full event for debugging (redact sensitive data)
    const appUserIdShort = appUserId ? appUserId.substring(0, 8) + '...' : 'none';
    console.log(`[revenuecat-webhook] Event: ${type}, appUserId: ${appUserIdShort}, store: ${store}, product: ${productId}`);
    
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

    // ═══════════════════════════════════════════════════════════════
    // BUILD COMPREHENSIVE UPDATE PAYLOAD
    // ═══════════════════════════════════════════════════════════════
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    
    if (activate || isTransfer) {
      updatePayload["is_subscribed"] = true;
      updatePayload["subscription_status"] = "active";
    }
    if (deactivate) {
      updatePayload["is_subscribed"] = false;
      updatePayload["subscription_status"] = "expired";
    }
    if (rcCustomerId) {
      updatePayload["revenuecat_id"] = rcCustomerId;
    }
    
    // NEW: Set payment_method from store (apple, google, stripe, etc.)
    if (store) {
      updatePayload["payment_method"] = mapStoreToPaymentMethod(store);
    }
    
    // NEW: Set plan_name from product_id
    if (productId) {
      updatePayload["plan_name"] = mapProductToPlanName(productId);
    }
    
    // NEW: Set billing dates
    if (purchasedAtMs && activate) {
      updatePayload["billing_start_date"] = new Date(purchasedAtMs).toISOString();
    }
    if (expirationAtMs) {
      updatePayload["next_billing_date"] = new Date(expirationAtMs).toISOString();
    }

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

    // ═══════════════════════════════════════════════════════════════
    // CREATE/UPDATE SUBSCRIPTIONS TABLE RECORD
    // ═══════════════════════════════════════════════════════════════
    if (updated && updatedUserId && activate && productId) {
      try {
        const subscriptionData = {
          user_id: updatedUserId,
          status: "active",
          plan_name: mapProductToPlanName(productId),
          billing_amount: price || null,
          billing_currency: currency || "USD",
          billing_cycle: getBillingCycle(productId),
          payment_method: store ? mapStoreToPaymentMethod(store) : "iap",
          start_date: new Date(purchasedAtMs).toISOString(),
          next_billing_date: expirationAtMs ? new Date(expirationAtMs).toISOString() : null,
          updated_at: new Date().toISOString()
        };

        // Upsert: Update if exists, insert if not
        const { error: subError } = await supabase
          .from("subscriptions")
          .upsert(subscriptionData, { 
            onConflict: "user_id",
            ignoreDuplicates: false 
          });

        if (subError) {
          console.error(`[revenuecat-webhook] Failed to upsert subscription:`, subError);
        } else {
          console.log(`[revenuecat-webhook] Upserted subscription for user ${updatedUserId.substring(0, 8)}...`);
        }
      } catch (subErr) {
        console.error(`[revenuecat-webhook] Subscription upsert error:`, subErr);
      }
    }

    // Update subscription status to expired/cancelled
    if (updated && updatedUserId && deactivate) {
      try {
        await supabase
          .from("subscriptions")
          .update({ 
            status: type.toLowerCase().includes("cancel") ? "cancelled" : "expired",
            updated_at: new Date().toISOString()
          })
          .eq("user_id", updatedUserId);
        console.log(`[revenuecat-webhook] Updated subscription status to deactivated`);
      } catch (subErr) {
        console.error(`[revenuecat-webhook] Subscription deactivate error:`, subErr);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      type, 
      appUserId,
      store,
      productId,
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
