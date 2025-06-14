
/**
 * Manually activate a PayPal subscription and update the user's profile.
 * Only for backend/admin use!
 * 
 * Body: { paypal_subscription_id: string, user_email: string }
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { paypal_subscription_id, user_email } = body as { paypal_subscription_id?: string; user_email?: string };

    if (!paypal_subscription_id || !user_email) {
      return new Response(JSON.stringify({ error: "paypal_subscription_id and user_email are required" }), { status: 400, headers: corsHeaders });
    }

    // Find the user by email
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", user_email.toLowerCase())
      .single();

    if (!profile || profileErr) {
      return new Response(JSON.stringify({ error: `No profile with email ${user_email}` }), { status: 404, headers: corsHeaders });
    }

    const user_id = profile.id;
    // Get today's date and one year from now (simulate yearly sub)
    const startDate = new Date().toISOString();
    const nextBillingDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

    // Insert into subscriptions or update existing
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("paypal_subscription_id", paypal_subscription_id)
      .maybeSingle();

    if (existingSubscription) {
      // Update to active, link to user just in case
      await supabase.from("subscriptions").update({
        user_id,
        status: "active",
        plan_name: "Yearly",
        start_date: startDate,
        next_billing_date: nextBillingDate,
        updated_at: new Date().toISOString()
      }).eq("id", existingSubscription.id);
    } else {
      // Insert new
      await supabase.from("subscriptions").insert([{
        user_id,
        paypal_subscription_id,
        paypal_plan_id: "P-5V753699962632454NBGLE6Y",
        status: "active",
        plan_name: "Yearly",
        billing_amount: 600,
        billing_currency: "QAR",
        billing_cycle: "yearly",
        start_date: startDate,
        next_billing_date: nextBillingDate,
        created_at: startDate,
        updated_at: startDate
      }]);
    }

    // Update profile
    await supabase.from("profiles").update({
      is_subscribed: true,
      subscription_status: "active",
      paypal_subscription_id,
      plan_name: "Yearly",
      billing_start_date: startDate,
      next_billing_date: nextBillingDate,
      updated_at: new Date().toISOString()
    }).eq("id", user_id);

    return new Response(JSON.stringify({ success: true, user_id }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", details: `${e}` }), { status: 500, headers: corsHeaders });
  }
});
