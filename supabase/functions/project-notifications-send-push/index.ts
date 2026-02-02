import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProjectNotificationRow = {
  id: string;
  project_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  push_sent: boolean | null;
  push_sent_at: string | null;
  onesignal_notification_id: string | null;
  created_at: string | null;
};

type OneSignalPayload = {
  app_id: string;
  include_aliases: { external_id: string[] };
  target_channel: "push";
  headings: { en: string };
  contents: { en: string };
  data?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return jsonResponse({ error: "OneSignal not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = typeof body.batch_size === "number" ? body.batch_size : 50;
    const projectId = typeof body.project_id === "string" ? body.project_id : null;
    const userId = typeof body.user_id === "string" ? body.user_id : null;

    // IMPORTANT: This function is owner-only. We only ever send to `project_notifications.user_id`.
    // Optional filters are supported for operational control (project_id/user_id), but never broaden scope.
    let query = supabase
      .from("project_notifications")
      .select("*")
      .eq("push_sent", false)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (projectId) query = query.eq("project_id", projectId);
    if (userId) query = query.eq("user_id", userId);

    const { data: notifications, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!notifications || notifications.length === 0) {
      return jsonResponse({ success: true, sent: 0, message: "No pending project notifications" });
    }

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const n of notifications as ProjectNotificationRow[]) {
      try {
        // Hard safety: only send to the row's user_id (project owner)
        const recipient = n.user_id;

        const payload: OneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_aliases: { external_id: [recipient] },
          target_channel: "push",
          headings: { en: n.title },
          contents: { en: n.message || "" },
          data: {
            ...(n.data || {}),
            notification_id: n.id,
            project_id: n.project_id,
            type: n.type,
          },
        };

        const res = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const resJson = await res.json().catch(() => ({}));

        if (res.ok && resJson?.id) {
          await supabase
            .from("project_notifications")
            .update({
              push_sent: true,
              push_sent_at: new Date().toISOString(),
              onesignal_notification_id: String(resJson.id),
            })
            .eq("id", n.id)
            .eq("user_id", recipient);

          sentCount++;
          results.push({ id: n.id, success: true });
        } else {
          failedCount++;
          const errorMsg = Array.isArray(resJson?.errors)
            ? resJson.errors.join(", ")
            : JSON.stringify(resJson);
          results.push({ id: n.id, success: false, error: errorMsg || "Unknown error" });
        }
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: n.id, success: false, error: msg });
      }
    }

    return jsonResponse({ success: true, sent: sentCount, failed: failedCount, total: notifications.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
