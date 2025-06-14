/**
 * PayPal Webhook Handler for WAKTI
 * - Handles subscription events, updates Supabase `subscriptions` and `profiles`
 * - CORS & PayPal verification support
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ! Update these with your Supabase project info:
const SUPABASE_URL = "https://hxauxozopvpzpdygoqwf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    // Must be POST
    if (req.method !== "POST") {
      return new Response("Only POST", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("PayPal Webhook received:", JSON.stringify(body));

    // Extract event/resource information per PayPal docs
    // see: https://developer.paypal.com/docs/api-basics/notifications/webhooks/event-names/

    // The resource usually contains subscription info, plan, status
    const eventType = body.event_type;
    const resource = body.resource || {};

    // Only process subscription events
    const allowedEventTypes = [
      "BILLING.SUBSCRIPTION.CREATED",
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "PAYMENT.SALE.COMPLETED"
    ];
    if (!allowedEventTypes.includes(eventType)) {
      console.log("Ignored event:", eventType);
      return new Response("Event ignored", { headers: corsHeaders });
    }

    // You may want to verify the PayPal webhook signature here (see PayPal docs).
    // For now, we skip/assume PayPal only calls the right endpoint.

    // Extract subscription fields
    const paypalSubscriptionId = resource.id || resource.billing_agreement_id || resource.subscription_id; // One of these
    const planId = resource.plan_id;
    const status = resource.status || resource.state;
    const subscriber = resource.subscriber || {};
    const startTime = resource.start_time || resource.create_time;
    const nextBillingTime = resource.next_billing_time || resource.next_payment && resource.next_payment.time;

    // Try to get user id: store it in custom_id field when you create subscriptions
    // (Otherwise, you have to map PayPal subscription to user via email or other means)
    let userId = null;
    if (subscriber.custom_id) userId = subscriber.custom_id;

    // Attempt to map PayPal subscription ID to user, fallback to nothing
    // Optionally, you could try to look up a user by e-mail, but here we only update by paypal_subscription_id

    // Update subscriptions table
    if (paypalSubscriptionId) {
      // Try to fetch existing subscription by PayPal ID
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id, user_id")
        .eq("paypal_subscription_id", paypalSubscriptionId)
        .single();

      // Bill/plan info
      const planName =
        (resource.plan_overview && resource.plan_overview.name) ||
        planId ||
        "Unknown Plan";
      const billingAmount =
        resource.billing_info && resource.billing_info.last_payment && resource.billing_info.last_payment.amount && resource.billing_info.last_payment.amount.value
          ? Number(resource.billing_info.last_payment.amount.value)
          : 0;
      const billingCurrency =
        resource.billing_info && resource.billing_info.last_payment && resource.billing_info.last_payment.amount && resource.billing_info.last_payment.amount.currency_code
          ? resource.billing_info.last_payment.amount.currency_code
          : "QAR";
      const billingCycle = planName.toLowerCase().includes("year") ? "yearly" : "monthly";

      // Determine columns
      const updateObj: any = {
        plan_name: planName,
        paypal_plan_id: planId || null,
        paypal_subscription_id: paypalSubscriptionId,
        status: status || "active",
        billing_amount: billingAmount,
        billing_currency: billingCurrency,
        billing_cycle: billingCycle,
        start_date: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        next_billing_date: nextBillingTime ? new Date(nextBillingTime).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existingSubscription) {
        // Update
        await supabase
          .from("subscriptions")
          .update(updateObj)
          .eq("paypal_subscription_id", paypalSubscriptionId);
        userId = existingSubscription.user_id; // get it for profile update
      } else {
        // Insert: You must have user_id available (e.g., map from PayPal custom_id or after manual verification)
        if (!userId) {
          console.error("No user_id found for new subscription event. SKIPPING DB insert.");
        } else {
          await supabase.from("subscriptions").insert([
            {
              ...updateObj,
              user_id: userId,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }

      // Update profiles status (if user_id available)
      if (userId) {
        let profilesUpdate: any = {
          is_subscribed: status === "ACTIVE",
          subscription_status: status || null,
          plan_name: planName,
          billing_start_date: startTime ? new Date(startTime).toISOString() : null,
          next_billing_date: nextBillingTime ? new Date(nextBillingTime).toISOString() : null,
          paypal_subscription_id: paypalSubscriptionId,
          updated_at: new Date().toISOString(),
        };

        // Some events mean subscription is over
        if (["CANCELLED", "EXPIRED", "SUSPENDED"].includes((status || "").toUpperCase())) {
          profilesUpdate.is_subscribed = false;
          profilesUpdate.subscription_status = (status || "inactive").toLowerCase();
        }

        await supabase
          .from("profiles")
          .update(profilesUpdate)
          .eq("id", userId);
      }
    }

    return new Response("Webhook processed", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("webhook error", err);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
