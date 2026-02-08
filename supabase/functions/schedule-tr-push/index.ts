import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TRPushKind = "tr_reminder_due" | "tr_task_due";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("[schedule-tr-push] Missing OneSignal credentials");
      return new Response(JSON.stringify({ error: "OneSignal not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[schedule-tr-push] Missing Supabase env vars: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Supabase not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_ANON_KEY) {
      console.error("[schedule-tr-push] Missing Supabase anon key env var");
      return new Response(JSON.stringify({ error: "Supabase anon key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      user_id,
      kind,
      item_id,
      notification_id,
      title,
      reminder_text,
      scheduled_for,
      deep_link,
    } = body as {
      user_id: string;
      kind: TRPushKind;
      item_id: string;
      notification_id: string;
      title?: string;
      reminder_text: string;
      scheduled_for: string;
      deep_link?: string;
    };

    if (!user_id || !kind || !item_id || !notification_id || !reminder_text || !scheduled_for) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: user_id, kind, item_id, notification_id, reminder_text, scheduled_for",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[schedule-tr-push] request kind=${kind} user_id=${user_id} item_id=${item_id} notification_id=${notification_id} scheduled_for=${scheduled_for}`,
    );

    const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: userData } = await authSupabase.auth.getUser();
    const authedUserId = userData?.user?.id || null;

    if (!authedUserId || authedUserId !== user_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Ownership check: ensure the TR record belongs to the user
    if (kind === "tr_reminder_due") {
      const { data: row } = await supabase
        .from("tr_reminders")
        .select("id, user_id, title")
        .eq("id", item_id)
        .single();

      if (!row || row.user_id !== user_id) {
        return new Response(JSON.stringify({ error: "Reminder not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (kind === "tr_task_due") {
      const { data: row } = await supabase
        .from("tr_tasks")
        .select("id, user_id, title")
        .eq("id", item_id)
        .single();

      if (!row || row.user_id !== user_id) {
        return new Response(JSON.stringify({ error: "Task not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendAfterDate = new Date(scheduled_for);
    if (isNaN(sendAfterDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid scheduled_for date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [user_id] },
      target_channel: "push",
      headings: { en: title || (kind === "tr_task_due" ? "Task Due" : "Reminder") },
      contents: { en: reminder_text },
      send_after: sendAfterDate.toISOString(),
      data: {
        type: kind,
        notification_id,
        scheduled_for,
        deep_link: deep_link || "/tr",
        ...(kind === "tr_task_due" ? { tr_task_id: item_id } : { tr_reminder_id: item_id }),
      },
    };

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const resultText = await response.text();
    let result: unknown = null;
    try {
      result = JSON.parse(resultText) as unknown;
    } catch {
      result = { raw: resultText };
    }

    const resultObj = ((): Record<string, unknown> | null => {
      if (!result || typeof result !== "object") return null;
      return result as Record<string, unknown>;
    })();

    const onesignalId = typeof resultObj?.id === "string" ? (resultObj?.id as string) : null;

    if (response.ok && onesignalId) {
      const { data: existing } = await supabase
        .from("notification_history")
        .select("data")
        .eq("id", notification_id)
        .single();

      const mergedData = {
        ...(existing?.data || {}),
        onesignal_notification_id: onesignalId,
        scheduled_delivery: true,
      };

      await supabase
        .from("notification_history")
        .update({
          push_sent: true,
          push_sent_at: new Date().toISOString(),
          data: mergedData,
        })
        .eq("id", notification_id)
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({ success: true, onesignal_id: onesignalId, scheduled_for: sendAfterDate.toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.error("[schedule-tr-push] OneSignal schedule failed", {
      status: response.status,
      result,
    });

    const errors = ((): string | null => {
      const maybeErrors = resultObj?.["errors"];
      if (!Array.isArray(maybeErrors)) return null;
      const strs = maybeErrors.filter((x) => typeof x === "string") as string[];
      return strs.length > 0 ? strs.join(", ") : null;
    })();

    const errorMsg = errors || JSON.stringify(result);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[schedule-tr-push] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
