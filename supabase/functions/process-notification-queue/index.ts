// Supabase Edge Function: process-notification-queue
// Processes pending notifications from notification_queue table and sends via OneSignal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueuedNotification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  deep_link: string | null;
  scheduled_for: string;
  status: string;
  attempts: number;
}

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
      console.error("Missing OneSignal credentials");
      return new Response(
        JSON.stringify({ error: "OneSignal not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending notifications from notification_queue
    const { data: notifications, error: fetchError } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No pending notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${notifications.length} notifications from queue`);

    let sentCount = 0;
    let failedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const notif of notifications as QueuedNotification[]) {
      try {
        // Build OneSignal payload
        const payload = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [notif.user_id] },
          target_channel: "push",
          headings: { en: notif.title },
          contents: { en: notif.body },
          data: {
            ...(notif.data || {}),
            notification_id: notif.id,
            type: notif.notification_type,
          },
        };

        console.log(`Sending push for notification ${notif.id} to user ${notif.user_id}`);

        // Send to OneSignal
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
          // Mark as sent
          await supabase
            .from("notification_queue")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(),
              attempts: (notif.attempts || 0) + 1
            })
            .eq("id", notif.id);

          sentCount++;
          results.push({ id: notif.id, success: true });
          console.log(`Push sent successfully for ${notif.id}: OneSignal ID ${result.id}`);
        } else {
          // Mark as failed but allow retry
          const errorMsg = result.errors?.join(", ") || JSON.stringify(result) || "Unknown error";
          await supabase
            .from("notification_queue")
            .update({ 
              status: (notif.attempts || 0) >= 3 ? "failed" : "pending",
              attempts: (notif.attempts || 0) + 1
            })
            .eq("id", notif.id);

          failedCount++;
          results.push({ id: notif.id, success: false, error: errorMsg });
          console.error(`Push failed for ${notif.id}:`, errorMsg);
        }
      } catch (err) {
        // Mark as failed but allow retry
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase
          .from("notification_queue")
          .update({ 
            status: (notif.attempts || 0) >= 3 ? "failed" : "pending",
            attempts: (notif.attempts || 0) + 1
          })
          .eq("id", notif.id);

        failedCount++;
        results.push({ id: notif.id, success: false, error: errorMsg });
        console.error(`Error processing ${notif.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: notifications.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-notification-queue:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
