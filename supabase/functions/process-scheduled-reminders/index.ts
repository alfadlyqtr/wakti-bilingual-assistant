// Supabase Edge Function: process-scheduled-reminders
// Processes scheduled reminders and triggers push notifications via wakti-send-push
// Should be called via cron job every 5 minutes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[process-scheduled-reminders] Starting reminder check...");

    // Find all reminders that are due (scheduled_for <= now AND push_sent = false)
    const now = new Date().toISOString();
    const { data: dueReminders, error: fetchError } = await supabase
      .from("notification_history")
      .select("*")
      .not("scheduled_for", "is", null)
      .lte("scheduled_for", now)
      .eq("push_sent", false)
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process up to 50 reminders per run

    if (fetchError) {
      console.error("[process-scheduled-reminders] Error fetching reminders:", fetchError);
      throw fetchError;
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log("[process-scheduled-reminders] No due reminders found");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No due reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled-reminders] Found ${dueReminders.length} due reminders`);

    let processedCount = 0;
    let failedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];

    // Process each due reminder by calling wakti-send-push
    for (const reminder of dueReminders) {
      try {
        console.log(`[process-scheduled-reminders] Processing reminder ${reminder.id} for user ${reminder.user_id}`);

        // Call wakti-send-push to send the notification
        const pushResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/wakti-send-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              notification_id: reminder.id,
            }),
          }
        );

        const pushResult = await pushResponse.json();

        if (pushResponse.ok && pushResult.sent > 0) {
          processedCount++;
          results.push({ id: reminder.id, success: true });
          console.log(`[process-scheduled-reminders] Successfully sent reminder ${reminder.id}`);
        } else {
          failedCount++;
          const errorMsg = pushResult.error || "Push send returned 0 sent";
          results.push({ id: reminder.id, success: false, error: errorMsg });
          console.error(`[process-scheduled-reminders] Failed to send reminder ${reminder.id}:`, errorMsg);
        }
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        results.push({ id: reminder.id, success: false, error: errorMsg });
        console.error(`[process-scheduled-reminders] Error processing reminder ${reminder.id}:`, err);
      }
    }

    console.log(`[process-scheduled-reminders] Completed: ${processedCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        total: dueReminders.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-scheduled-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
