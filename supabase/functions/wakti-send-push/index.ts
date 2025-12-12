// Supabase Edge Function: wakti-send-push
// Sends push notifications via OneSignal REST API
// Can be called manually or triggered by a webhook/cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  deep_link: string | null;
  push_sent: boolean;
}

interface OneSignalPayload {
  app_id: string;
  include_aliases: { external_id: string[] };
  target_channel: string;
  headings: { en: string };
  contents: { en: string };
  data?: Record<string, any>;
  url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { notification_id, user_id, batch_size = 50 } = body;

    let notifications: NotificationRow[] = [];

    if (notification_id) {
      // Send specific notification
      const { data, error } = await supabase
        .from("notification_history")
        .select("*")
        .eq("id", notification_id)
        .eq("push_sent", false)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Notification not found or already sent" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      notifications = [data];
    } else if (user_id) {
      // Send all pending for a specific user
      const { data, error } = await supabase
        .from("notification_history")
        .select("*")
        .eq("user_id", user_id)
        .eq("push_sent", false)
        .order("created_at", { ascending: true })
        .limit(batch_size);

      if (error) throw error;
      notifications = data || [];
    } else {
      // Process batch of pending notifications
      const { data, error } = await supabase
        .from("notification_history")
        .select("*")
        .eq("push_sent", false)
        .order("created_at", { ascending: true })
        .limit(batch_size);

      if (error) throw error;
      notifications = data || [];
    }

    if (notifications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No pending notifications" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${notifications.length} notifications`);

    let sentCount = 0;
    let failedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const notif of notifications) {
      try {
        // Build OneSignal payload
        const payload: OneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [notif.user_id] },
          target_channel: "push",
          headings: { en: notif.title },
          contents: { en: notif.body },
        };

        // Add data payload (no URL - tapping notification just opens the app)
        payload.data = {
          ...(notif.data || {}),
          notification_id: notif.id,
          type: notif.type,
        };

        console.log(`Sending push for notification ${notif.id} to user ${notif.user_id}`);

        // Send to OneSignal (using new API endpoint and 'key' auth scheme per docs)
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
            .from("notification_history")
            .update({ push_sent: true, push_sent_at: new Date().toISOString() })
            .eq("id", notif.id);

          sentCount++;
          results.push({ id: notif.id, success: true });
          console.log(`Push sent successfully for ${notif.id}: OneSignal ID ${result.id}`);
        } else {
          failedCount++;
          const errorMsg = result.errors?.join(", ") || "Unknown error";
          results.push({ id: notif.id, success: false, error: errorMsg });
          console.error(`Push failed for ${notif.id}:`, errorMsg);
        }
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
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
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
