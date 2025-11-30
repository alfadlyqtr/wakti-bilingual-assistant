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
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_subscribed: true,
          subscription_status: "active",
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      
      if (updateError) {
        console.error("[check-subscription] Supabase update error:", updateError);
      } else {
        console.log(`[check-subscription] Updated profile for user ${userIdShort}...: is_subscribed=true`);
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
