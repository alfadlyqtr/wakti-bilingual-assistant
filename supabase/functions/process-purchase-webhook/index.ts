
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
    if (req.method !== "POST") {
      return new Response("Only POST", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("Purchase Webhook received:", JSON.stringify(body));

    const eventType = body.event_type;
    const resource = body.resource || {};

    // Only process completed payment events
    if (eventType !== "PAYMENT.SALE.COMPLETED") {
      console.log("Ignored event:", eventType);
      return new Response("Event ignored", { headers: corsHeaders });
    }

    const transactionId = resource.id;
    const amount = resource.amount ? parseFloat(resource.amount.total) : 0;
    
    // Get custom field from multiple possible locations
    const customId = resource.custom || resource.custom_id || resource.invoice_number;
    
    console.log("Processing payment:", { transactionId, amount, customId });
    
    // Extract user ID and purchase type from custom field
    // Expected format: "userId:purchaseType" (e.g., "123e4567-e89b-12d3-a456-426614174000:voice_credits")
    if (!customId || !customId.includes(':')) {
      console.error("Invalid custom ID format:", customId);
      return new Response("Invalid custom ID", { status: 400, headers: corsHeaders });
    }

    const [userId, purchaseType] = customId.split(':');
    
    if (!userId || !purchaseType) {
      console.error("Missing userId or purchaseType:", { userId, purchaseType });
      return new Response("Missing purchase data", { status: 400, headers: corsHeaders });
    }

    console.log("Processing purchase:", { userId, purchaseType, transactionId, amount });

    let success = false;

    // Process different purchase types
    if (purchaseType === 'voice_credits') {
      console.log("Processing voice credits purchase for user:", userId);
      const { data, error } = await supabase.rpc('process_voice_credits_purchase', {
        p_user_id: userId,
        p_transaction_id: transactionId,
        p_amount: amount
      });
      success = !error;
      if (error) console.error("Voice credits purchase error:", error);
      else console.log("Voice credits purchase successful:", data);
    } else if (purchaseType === 'translation_credits') {
      console.log("Processing translation credits purchase for user:", userId);
      const { data, error } = await supabase.rpc('process_translation_credits_purchase', {
        p_user_id: userId,
        p_transaction_id: transactionId,
        p_amount: amount
      });
      success = !error;
      if (error) console.error("Translation credits purchase error:", error);
      else console.log("Translation credits purchase successful:", data);
    } else {
      console.error("Unknown purchase type:", purchaseType);
      return new Response("Unknown purchase type", { status: 400, headers: corsHeaders });
    }

    if (success) {
      console.log("Purchase processed successfully:", { userId, purchaseType, transactionId });
      return new Response("Purchase processed", { status: 200, headers: corsHeaders });
    } else {
      console.error("Failed to process purchase:", { userId, purchaseType, transactionId });
      return new Response("Processing failed", { status: 500, headers: corsHeaders });
    }

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
