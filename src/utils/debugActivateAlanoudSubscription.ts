
// This util can be run to activate alanoud.qtr6@gmail.com's subscription with evidence.
// For ADMINS/DEBUG ONLY. Remove after use.

import { supabase } from "@/integrations/supabase/client";

// Manually call the edge function!
export async function activateAlanoudSubscriptionWithEvidence() {
  const payload = {
    paypal_subscription_id: "I-CRLV1LY33R8B",
    user_email: "alanoud.qtr6@gmail.com",
    plan: "monthly"
  };
  const url = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/activate-paypal-subscription";

  // Use anon key for authorization (admin should use service role in real life!)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU"
    },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  console.log("Edge function activation result:", result);

  // Now query the profile for evidence
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date, paypal_subscription_id")
    .eq("email", "alanoud.qtr6@gmail.com")
    .maybeSingle();

  if (error) {
    console.error("DB profile check error:", error);
  }
  console.log("PROFILE AFTER ACTIVATION:", profile);

  return { edgeFnResult: result, profile };
}

// Run immediately ONLY if in debug/demo/dev
if (typeof window !== "undefined" && window.location?.hash === "#activate-alanoud") {
  activateAlanoudSubscriptionWithEvidence().then(console.log).catch(console.error);
}

// The activation util for Alanoud's subscription

async function runImmediateActivation() {
  // Run the edge function call (same as in activateAlanoudSubscriptionWithEvidence)
  const payload = {
    paypal_subscription_id: "I-CRLV1LY33R8B",
    user_email: "alanoud.qtr6@gmail.com",
    plan: "monthly",
  };
  const url = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/activate-paypal-subscription";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey":
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU",
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log("Activation result (edge function):", result);

    if (!result.success) {
      alert(
        "Activation failed: " +
          (result.error || JSON.stringify(result))
      );
    } else {
      alert(
        "Alanoud's subscription is now ACTIVE. Reload the app and she should have access!"
      );
    }

    // Optional: check the final profile in DB
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "email, is_subscribed, subscription_status, plan_name, billing_start_date, next_billing_date, paypal_subscription_id"
      )
      .eq("email", "alanoud.qtr6@gmail.com")
      .maybeSingle();

    if (error) {
      console.error("Profile DB check error:", error);
    }
    console.log("PROFILE AFTER ACTIVATION:", profile);
    return { result, profile };
  } catch (error) {
    console.error("Activation error:", error);
    alert(
      "Activation error: " +
        (error instanceof Error ? error.message : String(error))
    );
    throw error;
  }
}

// Run immediately in the browser if we're on dashboard with #activate-alanoud-now
if (
  typeof window !== "undefined" &&
  window.location?.hash === "#activate-alanoud-now"
) {
  runImmediateActivation();
}

export { runImmediateActivation };

