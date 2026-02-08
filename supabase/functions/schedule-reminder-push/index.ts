// Supabase Edge Function: schedule-reminder-push
// Schedules a push notification for a specific time using OneSignal's send_after parameter
// Called immediately when a reminder is created - OneSignal handles the timing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("[schedule-reminder-push] Missing OneSignal credentials");
      return new Response(
        JSON.stringify({ error: "OneSignal not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { user_id, reminder_text, scheduled_for, notification_id } = body;

    if (!user_id || !reminder_text || !scheduled_for) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, reminder_text, scheduled_for" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-reminder-push] Scheduling push for user ${user_id} at ${scheduled_for}`);

    // OneSignal send_after expects ISO 8601 format or Unix timestamp
    const sendAfterDate = new Date(scheduled_for);
    if (isNaN(sendAfterDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid scheduled_for date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build OneSignal payload with send_after for scheduled delivery
    const payload: Record<string, any> = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [user_id] },
      target_channel: "push",
      headings: { en: "⏰ Wakti Reminder" },
      contents: { en: reminder_text },
      send_after: sendAfterDate.toISOString(),
      data: {
        type: "ai_reminder",
        notification_id: notification_id || null,
        scheduled_for: scheduled_for,
      },
    };

    console.log(`[schedule-reminder-push] Sending to OneSignal with send_after: ${sendAfterDate.toISOString()}`);

    // Send to OneSignal - it will hold and deliver at the scheduled time
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.id) {
      console.log(`[schedule-reminder-push] ✅ Scheduled successfully: OneSignal ID ${result.id}`);

      // Update notification_history to mark as scheduled (not sent yet, but queued)
      if (notification_id) {
        await supabase
          .from("notification_history")
          .update({ 
            push_sent: true, // Mark as handled (OneSignal will deliver it)
            push_sent_at: new Date().toISOString(),
            data: { 
              onesignal_notification_id: result.id,
              scheduled_delivery: true 
            }
          })
          .eq("id", notification_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          onesignal_id: result.id,
          scheduled_for: sendAfterDate.toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const rawErr = result.errors;
      const errorMsg = Array.isArray(rawErr)
        ? rawErr.join(", ")
        : typeof rawErr === 'string'
          ? rawErr
          : rawErr ? JSON.stringify(rawErr) : JSON.stringify(result);
      console.error(`[schedule-reminder-push] ❌ Failed:`, errorMsg);
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[schedule-reminder-push] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
