
/**
 * Manually activate a PayPal subscription and update the user's profile.
 * Only for backend/admin use!
 *
 * Body: { paypal_subscription_id: string, user_email: string, plan: "monthly" | "yearly" }
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

const MONTHLY_PLAN_ID = "P-5RM543441H466435NNBGLCWA";
const YEARLY_PLAN_ID = "P-5V753699962632454NBGLE6Y";
const MONTHLY_AMOUNT = 60; // QAR
const YEARLY_AMOUNT = 600; // QAR

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Accept new "plan" param
    const { paypal_subscription_id, user_email, plan } = body as {
      paypal_subscription_id?: string;
      user_email?: string;
      plan?: string;
    };

    if (!paypal_subscription_id || !user_email || !plan) {
      return new Response(
        JSON.stringify({
          error: "paypal_subscription_id, user_email, and plan (monthly or yearly) are required",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const lowerPlan = plan.toLowerCase();
    let planDetails;
    if (lowerPlan === "monthly") {
      planDetails = {
        plan_name: "Monthly",
        billing_cycle: "monthly",
        billing_amount: MONTHLY_AMOUNT,
        paypal_plan_id: MONTHLY_PLAN_ID,
        monthsToAdd: 1,
      };
    } else if (lowerPlan === "yearly") {
      planDetails = {
        plan_name: "Yearly",
        billing_cycle: "yearly",
        billing_amount: YEARLY_AMOUNT,
        paypal_plan_id: YEARLY_PLAN_ID,
        monthsToAdd: 12,
      };
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid plan, must be 'monthly' or 'yearly'" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Find user by email
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", user_email.toLowerCase())
      .single();

    if (!profile || profileErr) {
      return new Response(
        JSON.stringify({ error: `No profile with email ${user_email}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    const user_id = profile.id;
    const startDate = new Date().toISOString();
    // Monthly/yearly from today
    const nextBillingDate = new Date(new Date().setMonth(new Date().getMonth() + planDetails.monthsToAdd)).toISOString();

    // Insert or update in subscriptions
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("paypal_subscription_id", paypal_subscription_id)
      .maybeSingle();

    if (existingSubscription) {
      await supabase
        .from("subscriptions")
        .update({
          user_id,
          status: "active",
          plan_name: planDetails.plan_name,
          billing_cycle: planDetails.billing_cycle,
          billing_amount: planDetails.billing_amount,
          paypal_plan_id: planDetails.paypal_plan_id,
          start_date: startDate,
          next_billing_date: nextBillingDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSubscription.id);
    } else {
      await supabase.from("subscriptions").insert([
        {
          user_id,
          paypal_subscription_id,
          paypal_plan_id: planDetails.paypal_plan_id,
          status: "active",
          plan_name: planDetails.plan_name,
          billing_amount: planDetails.billing_amount,
          billing_currency: "QAR",
          billing_cycle: planDetails.billing_cycle,
          start_date: startDate,
          next_billing_date: nextBillingDate,
          created_at: startDate,
          updated_at: startDate,
        },
      ]);
    }

    // Update profile
    await supabase
      .from("profiles")
      .update({
        is_subscribed: true,
        subscription_status: "active",
        paypal_subscription_id,
        plan_name: planDetails.plan_name,
        billing_start_date: startDate,
        next_billing_date: nextBillingDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user_id);

    // Fetch to confirm, return full subscription/profile data for evidence
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("id, is_subscribed, subscription_status, plan_name, paypal_subscription_id, billing_start_date, next_billing_date")
      .eq("id", user_id)
      .single();

    const { data: subData } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("paypal_subscription_id", paypal_subscription_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        user_id,
        updatedProfile,
        subscription: subData,
      }),
      { headers: corsHeaders }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: `${e}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});
