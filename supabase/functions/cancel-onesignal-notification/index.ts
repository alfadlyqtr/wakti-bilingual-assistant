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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(JSON.stringify({ error: "OneSignal not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, notification_id, onesignal_notification_id } = body;

    if (!user_id || !notification_id || !onesignal_notification_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, notification_id, onesignal_notification_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Supabase anon key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: notifRow } = await supabase
      .from("notification_history")
      .select("id, user_id")
      .eq("id", notification_id)
      .single();

    if (!notifRow || notifRow.user_id !== user_id) {
      return new Response(JSON.stringify({ error: "Notification not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cancelUrl = `https://api.onesignal.com/notifications/${onesignal_notification_id}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`;

    const cancelResp = await fetch(cancelUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key ${ONESIGNAL_REST_API_KEY}`,
      },
    });

    const cancelJson = await cancelResp.json().catch(() => ({}));

    if (!cancelResp.ok) {
      const errors = ((): string | null => {
        const r = cancelJson as Record<string, unknown>;
        const maybeErrors = r["errors"];
        if (!Array.isArray(maybeErrors)) return null;
        const strs = maybeErrors.filter((x) => typeof x === "string") as string[];
        return strs.length > 0 ? strs.join(", ") : null;
      })();

      const errMsg = errors || JSON.stringify(cancelJson);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("notification_history")
      .delete()
      .eq("id", notification_id)
      .eq("user_id", user_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
