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

    if (!SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Supabase anon key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { user_id, doc_id, doc_title, scheduled_for, notification_id } = body;

    if (!user_id || !doc_id || !doc_title || !scheduled_for) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, doc_id, doc_title, scheduled_for" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    // Verify the doc actually belongs to the user before scheduling a push
    const { data: docRow } = await supabase
      .from("user_warranties")
      .select("id, user_id")
      .eq("id", doc_id)
      .single();

    if (!docRow || docRow.user_id !== user_id) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
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
      headings: { en: "📄 Document Expiry" },
      contents: { en: `${doc_title} expires in 1 month` },
      send_after: sendAfterDate.toISOString(),
      data: {
        type: "doc_expiry",
        doc_id,
        doc_title,
        notification_id: notification_id || null,
        scheduled_for,
      },
    };

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
      if (notification_id) {
        const { data: existing } = await supabase
          .from("notification_history")
          .select("data")
          .eq("id", notification_id)
          .single();

        const mergedData = {
          ...(existing?.data || {}),
          onesignal_notification_id: result.id,
          scheduled_delivery: true,
          doc_id,
          doc_title,
        };

        await supabase
          .from("notification_history")
          .update({
            push_sent: true,
            push_sent_at: new Date().toISOString(),
            data: mergedData,
          })
          .eq("id", notification_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          onesignal_id: result.id,
          scheduled_for: sendAfterDate.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const errors = ((): string | null => {
      const r = result as Record<string, unknown>;
      const maybeErrors = r["errors"];
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
