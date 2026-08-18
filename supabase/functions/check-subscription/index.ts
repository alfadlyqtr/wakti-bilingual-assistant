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
    // === SECURITY: Derive userId from verified JWT, never trust body ===
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized", isSubscribed: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify the JWT via Supabase Auth (network-validated, not just decoded)
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authedUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authedUser) {
      console.error("[check-subscription] JWT validation failed:", authError?.message);
      return new Response(JSON.stringify({ error: "unauthorized", isSubscribed: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // userId is ALWAYS the verified JWT subject — body userId is ignored
    const userId = authedUser.id;

    // Validate userId is a proper UUID (defensive)
    if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      console.error("[check-subscription] Invalid userId from JWT");
      return new Response(JSON.stringify({ error: "invalid userId", isSubscribed: false }), {
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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch profile once — drives new-account retry window + downgrade protection
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, is_subscribed, payment_method, next_billing_date")
      .eq("id", userId)
      .maybeSingle();

    // Brand-new accounts can race RevenueCat's anonymous→identified linking
    // (offer-code flow: redeem → pay → install → sign up). Ask RC a few times
    // over ~10s before believing "not subscribed" for these accounts.
    const isNewAccount = !profile?.created_at ||
      (Date.now() - new Date(profile.created_at).getTime()) < 24 * 60 * 60 * 1000;
    const maxAttempts = isNewAccount ? 4 : 1;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Call RevenueCat REST API to get subscriber info (with retry for new accounts)
    let response: Response | null = null;
    // deno-lint-ignore no-explicit-any
    let data: any = null;
    let isSubscribed = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: {
            "Authorization": `Bearer ${RC_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (response.ok) {
        data = await response.json();
        const ents = data?.subscriber?.entitlements || {};
        const checkTime = new Date();
        isSubscribed = Object.values(ents).some((e) => {
          const ent = e as { expires_date?: string | null };
          return !ent.expires_date || new Date(ent.expires_date) > checkTime;
        });
      }

      if (isSubscribed) break;

      // Worth another ask only for new accounts when RC said "no" or "never heard of them"
      const worthRetry = isNewAccount && attempt < maxAttempts &&
        (response.status === 404 || response.ok);
      if (!worthRetry) break;

      console.log(`[check-subscription] Attempt ${attempt}/${maxAttempts}: not subscribed yet (RC status ${response.status}) — retrying in 2.5s`);
      await sleep(2500);
    }

    // Handle RevenueCat API errors (after retries)
    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      console.log(`[check-subscription] RevenueCat API status: ${status}`);

      // 404 means user doesn't exist in RC yet - that's OK
      if (status === 404) {
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

    const subscriber = data?.subscriber || {};
    const entitlements = subscriber?.entitlements || {};
    const subscriptions = subscriber?.subscriptions || {};

    // Check for any active entitlement
    const now = new Date();
    const activeEntitlements = Object.entries(entitlements).filter(([, e]) => {
      const ent = e as { expires_date?: string | null };
      // Lifetime entitlements have no expiration
      if (!ent.expires_date) return true;
      // Check if expiration is in the future
      return new Date(ent.expires_date) > now;
    });

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

    // Task 5: Free Ride Fix — if RC confirms no active entitlements, actively downgrade the profile
    if (!isSubscribed) {
      // Admin Gift Protection: check if this user has an active manual gift before downgrading
      const isManualGift = profile?.payment_method === "manual";
      const giftStillActive = isManualGift && profile?.next_billing_date && new Date(profile.next_billing_date) > now;

      if (giftStillActive) {
        console.log(`[check-subscription] User ${userId.substring(0, 8)}... has active admin gift until ${profile.next_billing_date} — skipping downgrade`);
        return new Response(JSON.stringify({
          isSubscribed: true,
          entitlements: [],
          subscriptions: [],
          reason: "admin_gift"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Never stamp "expired" on an account that was never subscribed.
      // Brand-new users (esp. offer-code redeemers whose purchase raced the
      // account link) must keep a clean state, not a false "expired" label.
      if (profile?.is_subscribed !== true) {
        console.log(`[check-subscription] User ${userId.substring(0, 8)}... was not previously subscribed — leaving profile untouched`);
        return new Response(JSON.stringify({
          isSubscribed: false,
          entitlements: [],
          subscriptions: [],
          reason: "never_subscribed"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error: downgradeError } = await supabase
        .from("profiles")
        .update({
          is_subscribed: false,
          subscription_status: "expired",
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (downgradeError) {
        console.error("[check-subscription] Downgrade update error:", downgradeError);
      } else {
        console.log(`[check-subscription] Downgraded profile for user ${userId.substring(0, 8)}...: is_subscribed=false, status=expired`);
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
