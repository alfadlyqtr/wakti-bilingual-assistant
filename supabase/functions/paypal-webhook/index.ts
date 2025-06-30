
/**
 * PayPal Webhook Handler for WAKTI - Production Version
 * - Handles ONLY PayPal subscription events (not database events)
 * - Updates Supabase `subscriptions` and `profiles` tables
 * - Enhanced logging and error handling
 * - Live PayPal integration ready
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
      console.log("❌ Non-POST request received:", req.method);
      return new Response("Only POST", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("🎯 PayPal Webhook received:", JSON.stringify(body, null, 2));

    // CRITICAL: Only process actual PayPal events, ignore database events
    if (body.type || body.table || body.schema === "realtime") {
      console.log("⚠️ Ignoring database event - this is a PayPal webhook");
      return new Response("Database event ignored", { headers: corsHeaders });
    }

    const eventType = body.event_type;
    const resource = body.resource || {};

    if (!eventType) {
      console.log("❌ No event_type found - not a valid PayPal webhook");
      return new Response("Invalid PayPal event", { status: 400, headers: corsHeaders });
    }

    console.log("📝 PayPal Event details:", {
      eventType,
      resourceId: resource.id,
      resourceStatus: resource.status,
      customId: resource.custom_id,
      subscriberInfo: resource.subscriber
    });

    // Only process PayPal subscription events
    const allowedEventTypes = [
      "BILLING.SUBSCRIPTION.CREATED",
      "BILLING.SUBSCRIPTION.ACTIVATED", 
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
      "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
      "BILLING.SUBSCRIPTION.UPDATED",
      "BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED",
      "PAYMENT.SALE.COMPLETED"
    ];

    if (!allowedEventTypes.includes(eventType)) {
      console.log("⏭️ Ignored PayPal event type:", eventType);
      return new Response("PayPal event ignored", { headers: corsHeaders });
    }

    console.log("✅ Processing PayPal subscription event:", eventType);

    // Extract subscription fields from PayPal event
    const paypalSubscriptionId = resource.id;
    const planId = resource.plan_id;
    const status = resource.status || resource.state;
    const subscriber = resource.subscriber || {};
    const startTime = resource.start_time || resource.create_time;
    const nextBillingTime = resource.billing_info?.next_billing_time || resource.next_billing_time;
    
    let userId = null;
    let mappingMethod = "none";

    console.log("🔍 Attempting user mapping for PayPal event...", {
      subscriberEmail: subscriber.email_address,
      resourceCustomId: resource.custom_id,
      planId,
      subscriptionId: paypalSubscriptionId
    });

    // Enhanced user mapping logic for PayPal events
    if (resource.custom_id) {
      userId = resource.custom_id;
      mappingMethod = "resource_custom_id";
      console.log("✅ User mapped via resource.custom_id:", userId);
    } else if (subscriber.custom_id) {
      userId = subscriber.custom_id;
      mappingMethod = "subscriber_custom_id";
      console.log("✅ User mapped via subscriber.custom_id:", userId);
    } else if (subscriber.email_address) {
      // Find userId by email in profiles
      console.log("🔍 Attempting email mapping for:", subscriber.email_address);
      const { data: existingProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", subscriber.email_address.toLowerCase())
        .single();
      
      if (existingProfile && existingProfile.id) {
        userId = existingProfile.id;
        mappingMethod = "email";
        console.log("✅ User mapped via email:", subscriber.email_address, "->", userId);
      } else {
        console.log("❌ Email mapping failed for:", subscriber.email_address, "Error:", profileErr);
      }
    }

    if (!userId) {
      console.error("❌ NO USER MAPPING POSSIBLE FOR PAYPAL EVENT");
      console.error("PayPal subscriber object:", JSON.stringify(subscriber));
      console.error("PayPal resource object:", JSON.stringify(resource));
      return new Response("No user mapping possible for PayPal event", { status: 200, headers: corsHeaders });
    }

    console.log("🎯 Processing PayPal subscription for user:", { userId, mappingMethod, eventType });

    // Update subscriptions table
    if (paypalSubscriptionId) {
      // Try to fetch existing subscription by PayPal ID
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id, user_id")
        .eq("paypal_subscription_id", paypalSubscriptionId)
        .single();

      // Determine plan details based on plan_id
      let planName = "Wakti Subscription";
      let billingAmount = 60;
      let billingCycle = "monthly";

      if (planId === "P-5V753699962632454NBGLE6Y") {
        planName = "Wakti Yearly Plan";
        billingAmount = 600;
        billingCycle = "yearly";
      } else if (planId === "P-5RM543441H466435NNBGLCWA") {
        planName = "Wakti Monthly Plan";
        billingAmount = 60;
        billingCycle = "monthly";
      }

      const billingCurrency = "QAR";

      // Determine columns for database update
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

      console.log("💾 PayPal subscription data to save:", updateObj);

      if (existingSubscription) {
        // Update existing subscription
        console.log("🔄 Updating existing PayPal subscription...");
        const { error: updateError } = await supabase
          .from("subscriptions")
          .update(updateObj)
          .eq("paypal_subscription_id", paypalSubscriptionId);
        
        if (updateError) {
          console.error("❌ Failed to update PayPal subscription:", updateError);
        } else {
          console.log("✅ PayPal subscription updated successfully");
        }
        
        userId = existingSubscription.user_id;
      } else {
        // Insert new subscription
        console.log("➕ Creating new PayPal subscription...");
        const { error: insertError } = await supabase.from("subscriptions").insert([{
          ...updateObj,
          user_id: userId,
          created_at: new Date().toISOString(),
        }]);
        
        if (insertError) {
          console.error("❌ Failed to create PayPal subscription:", insertError);
        } else {
          console.log("✅ New PayPal subscription created successfully for user:", userId);
        }
      }

      // Update profiles status
      console.log("👤 Updating user profile for PayPal subscription...");
      let profilesUpdate: any = {
        is_subscribed: (status || "").toUpperCase() === "ACTIVE",
        subscription_status: status ? status.toLowerCase() : "active",
        plan_name: planName,
        billing_start_date: startTime ? new Date(startTime).toISOString() : null,
        next_billing_date: nextBillingTime ? new Date(nextBillingTime).toISOString() : null,
        paypal_subscription_id: paypalSubscriptionId,
        updated_at: new Date().toISOString(),
      };

      // Handle cancellation/suspension events
      if (["CANCELLED", "EXPIRED", "SUSPENDED"].includes((status || "").toUpperCase())) {
        profilesUpdate.is_subscribed = false;
        profilesUpdate.subscription_status = (status || "inactive").toLowerCase();
        console.log("🚫 Setting PayPal subscription as inactive due to status:", status);
      }

      console.log("💾 Profile data to update for PayPal subscription:", profilesUpdate);

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profilesUpdate)
        .eq("id", userId);

      if (profileError) {
        console.error("❌ Failed to update profile for PayPal subscription:", profileError);
      } else {
        console.log("✅ Profile updated successfully for PayPal subscription, user:", userId);
      }
    }

    console.log("🎉 PayPal webhook processing completed successfully");
    return new Response("PayPal webhook processed successfully", { status: 200, headers: corsHeaders });
    
  } catch (err) {
    console.error("💥 PayPal webhook processing error:", err);
    return new Response("PayPal webhook error", { status: 500, headers: corsHeaders });
  }
});
