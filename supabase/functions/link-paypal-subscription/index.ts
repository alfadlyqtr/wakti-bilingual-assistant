
/**
 * Edge Function to manually link a PayPal subscription to the current user.
 * Body: { paypal_subscription_id: string }
 * Must be called by an authenticated user.
 * Links the PayPal subscription to the user if possible.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// IMPORTANT: This function requires the user to be authenticated (uses JWT)
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const body = await req.json();
    const { paypal_subscription_id } = body;
    if (!paypal_subscription_id) {
      return new Response(JSON.stringify({ error: "Missing PayPal subscription ID" }), { status: 400, headers: corsHeaders });
    }
    // Get user ID from access token
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    // Fetch subscription and update user_id if possible
    const { data: existingSubscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("paypal_subscription_id", paypal_subscription_id)
      .single();

    if (!existingSubscription) {
      return new Response(JSON.stringify({ error: "Subscription not found" }), { status: 404, headers: corsHeaders });
    }
    if (existingSubscription.user_id === userId) {
      return new Response(JSON.stringify({ success: true, message: "Subscription already linked to your account." }), { status: 200, headers: corsHeaders });
    }

    // Update the subscription's user_id, update user profile
    await supabase
      .from("subscriptions")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("paypal_subscription_id", paypal_subscription_id);

    await supabase
      .from("profiles")
      .update({
        is_subscribed: existingSubscription.status === "active",
        subscription_status: existingSubscription.status,
        plan_name: existingSubscription.plan_name,
        billing_start_date: existingSubscription.start_date,
        next_billing_date: existingSubscription.next_billing_date,
        paypal_subscription_id: paypal_subscription_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return new Response(JSON.stringify({ success: true, message: "Successfully linked PayPal subscription to your account." }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Manual PayPal subscription linking error", err);
    return new Response(JSON.stringify({ error: "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});
