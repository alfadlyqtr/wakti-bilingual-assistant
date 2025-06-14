
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
