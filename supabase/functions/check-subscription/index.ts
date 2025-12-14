import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required", isSubscribed: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate userId is a proper UUID to prevent injection
    if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      console.error("[check-subscription] Invalid userId format");
      return new Response(JSON.stringify({ error: "invalid userId format", isSubscribed: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[check-subscription] Checking user: ${userId.substring(0, 8)}...`);

    // Get RevenueCat API key
    const RC_API_KEY = Deno.env.get("REVENUECAT_API_KEY");
    if (!RC_API_KEY) {
      console.error("[check-subscription] REVENUECAT_API_KEY not set");
      return new Response(JSON.stringify({ isSubscribed: false, error: "config_error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Call RevenueCat REST API to get subscriber info
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: {
          "Authorization": `Bearer ${RC_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle RevenueCat API errors
    if (!response.ok) {
      console.log(`[check-subscription] RevenueCat API status: ${response.status}`);
      
      // 404 means user doesn't exist in RC yet - that's OK
      if (response.status === 404) {
        return new Response(JSON.stringify({ isSubscribed: false, reason: "user_not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ isSubscribed: false, error: "rc_api_error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const subscriber = data?.subscriber || {};
    const entitlements = subscriber?.entitlements || {};
    const subscriptions = subscriber?.subscriptions || {};
    
    // Check for any active entitlement
    const now = new Date();
    const activeEntitlements = Object.entries(entitlements).filter(([key, e]: [string, any]) => {
      // Lifetime entitlements have no expiration
      if (!e.expires_date) return true;
      // Check if expiration is in the future
      return new Date(e.expires_date) > now;
    });

    const isSubscribed = activeEntitlements.length > 0;
    const entitlementIds = activeEntitlements.map(([key]) => key);
    
    const userIdShort = userId.substring(0, 8);
    console.log(`[check-subscription] User ${userIdShort}...: isSubscribed=${isSubscribed}, entitlements=${entitlementIds.join(',')}`);

    // Update Supabase profile if subscribed
    if (isSubscribed) {
      // Get first active subscription details from RevenueCat response
      const firstSubKey = Object.keys(subscriptions)[0];
      const subDetails = firstSubKey ? (subscriptions as Record<string, unknown>)[firstSubKey] as Record<string, unknown> : null;
      const store = subDetails?.store as string || "";
      const productId = firstSubKey || "";
      const expiresDate = subDetails?.expires_date as string || null;
      
      // Build comprehensive update data
      const updateData: Record<string, unknown> = {
        is_subscribed: true,
        subscription_status: "active",
        updated_at: new Date().toISOString()
      };
      
      // Set payment method from store (apple, google, etc.)
      if (store) {
        const s = store.toUpperCase();
        if (s.includes("APP_STORE") || s.includes("APPLE")) updateData["payment_method"] = "apple";
        else if (s.includes("PLAY_STORE") || s.includes("GOOGLE")) updateData["payment_method"] = "google";
        else if (s.includes("STRIPE")) updateData["payment_method"] = "stripe";
        else updateData["payment_method"] = "iap";
      }
      
      // Set plan name from product ID - WAKTI SPECIFIC
      if (productId) {
        const p = productId.toLowerCase();
        if (p.includes("qr.wakti.ai.monthly") || p.includes("wakti.ai.monthly")) updateData["plan_name"] = "Wakti Pro Monthly";
        else if (p.includes("qr.wakti.ai.yearly") || p.includes("wakti.ai.yearly") || p.includes("annual")) updateData["plan_name"] = "Wakti Pro Yearly";
        else if (p.includes("qr.wakti.ai.lifetime") || p.includes("wakti.ai.lifetime")) updateData["plan_name"] = "Wakti Pro Lifetime";
        else if (p.includes("yearly") || p.includes("annual")) updateData["plan_name"] = "Wakti Pro Yearly";
        else if (p.includes("monthly")) updateData["plan_name"] = "Wakti Pro Monthly";
        else if (p.includes("lifetime")) updateData["plan_name"] = "Wakti Pro Lifetime";
        else updateData["plan_name"] = "Wakti Pro";
      }
      
      // Set expiration date
      if (expiresDate) {
        updateData["next_billing_date"] = expiresDate;
      }
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);
      
      if (updateError) {
        console.error("[check-subscription] Supabase update error:", updateError);
      } else {
        console.log(`[check-subscription] Updated profile for user ${userIdShort}...: is_subscribed=true, payment_method=${updateData["payment_method"] || 'unknown'}, plan=${updateData["plan_name"] || 'unknown'}`);
      }
    }

    return new Response(JSON.stringify({ 
      isSubscribed, 
      entitlements: entitlementIds,
      subscriptions: Object.keys(subscriptions)
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[check-subscription] Error:", err);
    return new Response(JSON.stringify({ error: "internal_error", isSubscribed: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
